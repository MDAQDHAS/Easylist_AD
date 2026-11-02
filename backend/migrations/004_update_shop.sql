-- ==============================================================================
-- EasyList: Migration 004 - Atomic Shop Details Update
-- ==============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.update_shop_for_user(
    p_user_id UUID,
    p_shop_id UUID,
    p_shop_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_updated_name TEXT;
    v_updated_phone TEXT;
    v_created_at TIMESTAMPTZ;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required';
    END IF;

    IF p_shop_id IS NULL THEN
        RAISE EXCEPTION 'Shop ID is required';
    END IF;

    -- Verify that the caller is an owner of the shop
    IF NOT EXISTS (
        SELECT 1 FROM public.shop_members 
        WHERE shop_id = p_shop_id AND user_id = p_user_id AND role = 'owner'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User is not an owner of this shop';
    END IF;

    IF p_shop_name IS NOT NULL THEN
        IF trim(p_shop_name) = '' THEN
            RAISE EXCEPTION 'Shop name cannot be empty';
        END IF;
        IF length(trim(p_shop_name)) > 150 THEN
            RAISE EXCEPTION 'Shop name is too long';
        END IF;
    END IF;

    IF p_phone IS NOT NULL AND length(trim(p_phone)) > 30 THEN
        RAISE EXCEPTION 'Phone number is too long';
    END IF;

    -- Update shop
    UPDATE public.shops
    SET 
        name = COALESCE(NULLIF(trim(p_shop_name), ''), name),
        phone = CASE 
            WHEN p_phone IS NOT NULL THEN NULLIF(trim(p_phone), '')
            ELSE phone
        END
    WHERE id = p_shop_id
    RETURNING name, phone, created_at INTO v_updated_name, v_updated_phone, v_created_at;

    RETURN jsonb_build_object(
        'success', true,
        'shop', jsonb_build_object(
            'id', p_shop_id,
            'name', v_updated_name,
            'phone', v_updated_phone,
            'created_at', v_created_at
        )
    );
END;
$$;

ALTER FUNCTION public.update_shop_for_user(UUID, UUID, TEXT, TEXT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.update_shop_for_user(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shop_for_user(UUID, UUID, TEXT, TEXT) TO service_role;

-- Grant service_role update privilege on public.shops
GRANT UPDATE ON TABLE public.shops TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

