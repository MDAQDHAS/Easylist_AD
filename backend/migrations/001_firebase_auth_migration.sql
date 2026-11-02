-- ==============================================================================
-- EasyList: Migration 001 - Hardened Firebase Authentication & Identity Mapping
-- ==============================================================================
-- Description:
--   Establishes safe identity mapping between Firebase Authentication UIDs (strings)
--   and internal application UUIDs with explicit state-machine-driven account linking.
--   Prevents account takeover, preserves existing shop data, and hardens database functions.
--
-- Safety Guarantees:
--   - Non-destructive: Existing shops and memberships are completely preserved.
--   - Safe Account Linking: Explicit confirmation token required; prevents silent takeover.
--   - Atomic: register_shop_for_user executes in a single transaction with pg_temp isolation.
--   - Least-Privilege: Identity access and privileged RPCs are restricted to service_role.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Create Identity Mapping Table with Explicit Linking State Machine
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_user_id UUID NOT NULL UNIQUE,
    firebase_uid VARCHAR(128) UNIQUE,
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    linking_status VARCHAR(30) NOT NULL DEFAULT 'UNLINKED', -- 'UNLINKED', 'LINKED', 'PENDING'
    linking_token_hash VARCHAR(64),
    linking_token_expires_at TIMESTAMPTZ,
    linking_attempts INT NOT NULL DEFAULT 0,
    linked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_identities OWNER TO postgres;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_internal_user_id 
    ON public.user_identities(internal_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_firebase_uid 
    ON public.user_identities(firebase_uid);

CREATE INDEX IF NOT EXISTS idx_user_identities_email 
    ON public.user_identities(lower(email));

-- ------------------------------------------------------------------------------
-- 2. Create Audit Log for Account Linking
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_linking_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_user_id UUID NOT NULL,
    firebase_uid VARCHAR(128) NOT NULL,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.account_linking_audit OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 3. Pre-populate Existing Supabase Users Who Own Legacy Shop Memberships
-- ------------------------------------------------------------------------------
-- Only pre-populate legacy auth.users rows as 'UNLINKED' when they actually hold
-- a membership in public.shop_members. Legacy auth.users rows with zero shop
-- memberships have no shop data at risk of takeover and should not be locked
-- into REQUIRES_LINKING when signing in with Firebase.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        INSERT INTO public.user_identities (
            internal_user_id, 
            email, 
            email_verified, 
            linking_status, 
            created_at
        )
        SELECT 
            u.id, 
            u.email, 
            (u.email_confirmed_at IS NOT NULL),
            'UNLINKED',
            u.created_at
        FROM auth.users u
        WHERE u.email IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM public.shop_members sm
              WHERE sm.user_id = u.id
          )
        ON CONFLICT (internal_user_id) DO NOTHING;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Ensure shop_members.id Column & Foreign Key Constraint on shop_members
-- ------------------------------------------------------------------------------
ALTER TABLE public.shop_members
    ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_members_id
    ON public.shop_members(id);

DO $$
DECLARE
    v_user_id_attnum SMALLINT;
    v_duplicate_user_count BIGINT;
    v_orphan_count BIGINT;
    v_conflicting_fk_count BIGINT;
    v_auth_fk_count BIGINT;
    v_identity_fk_count BIGINT;
    v_constraint RECORD;
BEGIN
    SELECT attnum INTO v_user_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'public.shop_members'::regclass
      AND attname = 'user_id'
      AND NOT attisdropped;

    SELECT count(*) INTO v_duplicate_user_count
    FROM (
        SELECT user_id
        FROM public.shop_members
        GROUP BY user_id
        HAVING count(*) > 1
    ) duplicate_memberships;

    IF v_duplicate_user_count > 0 THEN
        RAISE EXCEPTION
            'Migration stopped: % user(s) have duplicate shop memberships. Resolve these records explicitly before retrying.',
            v_duplicate_user_count;
    END IF;

    SELECT count(*) INTO v_conflicting_fk_count
    FROM pg_constraint c
    WHERE c.conrelid = 'public.shop_members'::regclass
      AND c.contype = 'f'
      AND v_user_id_attnum = ANY(c.conkey)
      AND (
          array_length(c.conkey, 1) <> 1
          OR c.conkey[1] <> v_user_id_attnum
          OR c.confrelid NOT IN (
              'auth.users'::regclass,
              'public.user_identities'::regclass
          )
      );

    IF v_conflicting_fk_count > 0 THEN
        RAISE EXCEPTION
            'Migration stopped: shop_members.user_id has % unexpected or composite foreign key(s). Review them before retrying.',
            v_conflicting_fk_count;
    END IF;

    SELECT count(*) INTO v_auth_fk_count
    FROM pg_constraint c
    WHERE c.conrelid = 'public.shop_members'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND array_length(c.conkey, 1) = 1
      AND c.conkey[1] = v_user_id_attnum;

    SELECT count(*) INTO v_identity_fk_count
    FROM pg_constraint c
    WHERE c.conrelid = 'public.shop_members'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.user_identities'::regclass
      AND array_length(c.conkey, 1) = 1
      AND c.conkey[1] = v_user_id_attnum;

    IF v_auth_fk_count > 1 OR (v_auth_fk_count > 0 AND v_identity_fk_count > 0) THEN
        RAISE EXCEPTION
            'Migration stopped: shop_members.user_id has conflicting auth.users and user_identities foreign keys. Review constraints before retrying.';
    END IF;

    SELECT count(*) INTO v_orphan_count
    FROM public.shop_members sm
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.user_identities ui
        WHERE ui.internal_user_id = sm.user_id
    );

    IF v_orphan_count > 0 THEN
        RAISE EXCEPTION
            'Migration stopped: % shop_members row(s) have no matching user_identities row. Resolve these records explicitly before retrying.',
            v_orphan_count;
    END IF;

    FOR v_constraint IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.shop_members'::regclass
          AND c.contype = 'f'
          AND c.confrelid = 'auth.users'::regclass
          AND array_length(c.conkey, 1) = 1
          AND c.conkey[1] = v_user_id_attnum
    LOOP
        EXECUTE format(
            'ALTER TABLE public.shop_members DROP CONSTRAINT %I',
            v_constraint.conname
        );
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'public.shop_members'::regclass
          AND c.conname = 'shop_members_internal_user_id_fkey'
          AND c.contype = 'f'
          AND c.confrelid = 'public.user_identities'::regclass
          AND array_length(c.conkey, 1) = 1
          AND c.conkey[1] = v_user_id_attnum
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM pg_constraint c
            WHERE c.conrelid = 'public.shop_members'::regclass
              AND c.conname = 'shop_members_internal_user_id_fkey'
        ) THEN
            RAISE EXCEPTION
                'Migration stopped: constraint shop_members_internal_user_id_fkey exists with an unexpected definition.';
        END IF;

        ALTER TABLE public.shop_members
            ADD CONSTRAINT shop_members_internal_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES public.user_identities(internal_user_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE;
    END IF;
END $$;

-- A user is allowed exactly one shop membership. Fail without changing rows
-- if existing data violates that rule.
DO $$
DECLARE
    v_user_id_attnum SMALLINT;
    v_constraint RECORD;
    v_duplicate_user_count BIGINT;
BEGIN
    SELECT attnum INTO v_user_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'public.shop_members'::regclass
      AND attname = 'user_id'
      AND NOT attisdropped;

    SELECT count(*) INTO v_duplicate_user_count
    FROM (
        SELECT user_id
        FROM public.shop_members
        GROUP BY user_id
        HAVING count(*) > 1
    ) duplicate_memberships;

    IF v_duplicate_user_count > 0 THEN
        RAISE EXCEPTION
            'Migration stopped: % user(s) have duplicate shop memberships. No membership rows were changed.',
            v_duplicate_user_count;
    END IF;

    SELECT c.conname, c.contype, c.conkey
    INTO v_constraint
    FROM pg_constraint c
    WHERE c.conrelid = 'public.shop_members'::regclass
      AND c.conname = 'shop_members_one_membership_per_user';

    IF FOUND THEN
        IF v_constraint.contype <> 'u'
           OR array_length(v_constraint.conkey, 1) <> 1
           OR v_constraint.conkey[1] <> v_user_id_attnum THEN
            RAISE EXCEPTION
                'Migration stopped: constraint shop_members_one_membership_per_user exists with an unexpected definition.';
        END IF;
    ELSE
        ALTER TABLE public.shop_members
            ADD CONSTRAINT shop_members_one_membership_per_user UNIQUE (user_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. Revoke Legacy register_shop Execution
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'register_shop' AND pronamespace = 'public'::regnamespace
    ) THEN
        REVOKE ALL ON FUNCTION public.register_shop(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. Hardened Atomic Stored Procedure: register_shop_for_user
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_shop_for_user(
    p_user_id UUID,
    p_shop_name TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_shop_id UUID;
    v_member_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required';
    END IF;

    -- Verify that the user exists in user_identities
    IF NOT EXISTS (SELECT 1 FROM public.user_identities WHERE internal_user_id = p_user_id) THEN
        RAISE EXCEPTION 'User identity does not exist';
    END IF;

    IF p_shop_name IS NULL OR trim(p_shop_name) = '' THEN
        RAISE EXCEPTION 'Shop name is required';
    END IF;

    IF length(trim(p_shop_name)) > 150 THEN
        RAISE EXCEPTION 'Shop name is too long';
    END IF;

    -- Enforce single shop membership rule
    IF EXISTS (SELECT 1 FROM public.shop_members WHERE user_id = p_user_id) THEN
        RAISE EXCEPTION 'User already has a shop membership';
    END IF;

    -- Insert shop
    INSERT INTO public.shops (name, phone)
    VALUES (trim(p_shop_name), NULLIF(trim(p_phone), ''))
    RETURNING id, created_at INTO v_shop_id, v_created_at;

    -- Insert membership as owner
    INSERT INTO public.shop_members (shop_id, user_id, role)
    VALUES (v_shop_id, p_user_id, 'owner')
    RETURNING id INTO v_member_id;

    RETURN jsonb_build_object(
        'success', true,
        'shop', jsonb_build_object(
            'id', v_shop_id,
            'name', trim(p_shop_name),
            'phone', NULLIF(trim(p_phone), ''),
            'created_at', v_created_at
        ),
        'membership', jsonb_build_object(
            'id', v_member_id,
            'shop_id', v_shop_id,
            'user_id', p_user_id,
            'role', 'owner'
        )
    );
END;
$$;

ALTER FUNCTION public.register_shop_for_user(UUID, TEXT, TEXT) OWNER TO postgres;

-- Restrict execution strictly to service_role
REVOKE ALL ON FUNCTION public.register_shop_for_user(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_shop_for_user(UUID, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 7. Restrict RLS & Table Grants on user_identities, audit, shops & shop_members
-- ------------------------------------------------------------------------------
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_linking_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_identities FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.account_linking_audit FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.shops, public.shop_members FROM service_role;

-- Ensure the SECURITY DEFINER owner (postgres) explicitly retains full required privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_identities TO postgres;
GRANT SELECT, INSERT ON TABLE public.account_linking_audit TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shops, public.shop_members TO postgres;

-- Grant least-privilege table access to service_role
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_identities TO service_role;
GRANT SELECT ON TABLE public.shops, public.shop_members TO service_role;

-- Shop writes go through the backend's service-role-only registration RPC.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.shops, public.shop_members
    FROM PUBLIC, anon, authenticated, service_role;
DROP POLICY IF EXISTS "Users can create their own shop membership" ON public.shop_members;
DROP POLICY IF EXISTS "Authenticated users can create shops" ON public.shops;
DROP POLICY IF EXISTS "Shop owners can update their shops" ON public.shops;
DROP POLICY IF EXISTS "Service role full access on account_linking_audit" ON public.account_linking_audit;
DROP POLICY IF EXISTS "Service role full access on user_identities" ON public.user_identities;

CREATE POLICY "Service role full access on user_identities"
    ON public.user_identities TO service_role USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache so new tables, columns, and RPCs are immediately visible
NOTIFY pgrst, 'reload schema';

COMMIT;
