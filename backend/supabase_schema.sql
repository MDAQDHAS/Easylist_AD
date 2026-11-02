-- EasyList Supabase Database Schema & Permissions
-- Run this script in the Supabase SQL Editor if needed (https://supabase.com/dashboard/project/eqirxktohtqvrfkxdmfk/sql)

-- 1. Ensure tables exist
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.shop_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (shop_id, user_id)
);

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
            'Schema setup stopped: % user(s) have duplicate shop memberships. No membership rows were changed.',
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
                'Schema setup stopped: constraint shop_members_one_membership_per_user exists with an unexpected definition.';
        END IF;
    ELSE
        ALTER TABLE public.shop_members
            ADD CONSTRAINT shop_members_one_membership_per_user UNIQUE (user_id);
    END IF;
END $$;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

-- Writes are handled by the Firebase-authenticated backend, not direct client
-- inserts or the legacy Supabase-auth registration function.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.shops, public.shop_members
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.shops, public.shop_members TO service_role;

-- 3. RLS Policies for shop_members
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_members' AND policyname = 'Users can view their own shop memberships'
    ) THEN
        CREATE POLICY "Users can view their own shop memberships"
        ON public.shop_members FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;

END $$;
DROP POLICY IF EXISTS "Users can create their own shop membership" ON public.shop_members;

-- 4. RLS Policies for shops
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shops' AND policyname = 'Users can view shops they belong to'
    ) THEN
        CREATE POLICY "Users can view shops they belong to"
        ON public.shops FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.shop_members
                WHERE shop_members.shop_id = shops.id
                AND shop_members.user_id = auth.uid()
            )
        );
    END IF;

END $$;
DROP POLICY IF EXISTS "Authenticated users can create shops" ON public.shops;
DROP POLICY IF EXISTS "Shop owners can update their shops" ON public.shops;

-- 5. Atomic register_shop RPC function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.register_shop(
    p_shop_name TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_shop_id UUID;
    v_member_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_shop_name IS NULL OR trim(p_shop_name) = '' THEN
        RAISE EXCEPTION 'Shop name is required';
    END IF;

    IF length(trim(p_shop_name)) > 150 THEN
        RAISE EXCEPTION 'Shop name is too long';
    END IF;

    -- Check if user already has a shop
    IF EXISTS (SELECT 1 FROM public.shop_members WHERE user_id = v_user_id) THEN
        RAISE EXCEPTION 'User already has a shop membership';
    END IF;

    -- Insert shop
    INSERT INTO public.shops (name, phone)
    VALUES (trim(p_shop_name), NULLIF(trim(p_phone), ''))
    RETURNING id, created_at INTO v_shop_id, v_created_at;

    -- Insert membership
    INSERT INTO public.shop_members (shop_id, user_id, role)
    VALUES (v_shop_id, v_user_id, 'owner')
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
            'user_id', v_user_id,
            'role', 'owner'
        )
    );
END;
$$;

-- This legacy function relies on Supabase Auth and is not used by the
-- Firebase-authenticated backend.
REVOKE ALL ON FUNCTION public.register_shop(TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
