-- Atomically validate and consume account-linking codes.
-- Run only after migration 001 has been reviewed and applied.

BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_account_linking(
    p_firebase_uid VARCHAR(128),
    p_email VARCHAR(255),
    p_code_hash VARCHAR(64),
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_identity public.user_identities%ROWTYPE;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_updated_rows INTEGER;
BEGIN
    IF p_firebase_uid IS NULL OR p_firebase_uid = ''
       OR p_email IS NULL OR p_email = ''
       OR p_code_hash IS NULL OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
        RETURN jsonb_build_object('status', 'invalid_request');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_identities
        WHERE firebase_uid = p_firebase_uid
    ) THEN
        RETURN jsonb_build_object('status', 'already_linked');
    END IF;

    BEGIN
        SELECT *
        INTO STRICT v_identity
        FROM public.user_identities
        WHERE lower(email) = lower(trim(p_email))
          AND firebase_uid IS NULL
          AND linking_status = 'PENDING'
        FOR UPDATE;
    EXCEPTION
        WHEN no_data_found THEN
            RETURN jsonb_build_object('status', 'not_found');
        WHEN too_many_rows THEN
            RETURN jsonb_build_object('status', 'ambiguous_email');
    END;

    v_now := clock_timestamp();

    IF v_identity.linking_attempts >= 5 THEN
        RETURN jsonb_build_object('status', 'attempts_exceeded');
    END IF;

    IF v_identity.linking_token_expires_at IS NULL
       OR v_identity.linking_token_expires_at <= v_now THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    IF v_identity.linking_token_hash IS DISTINCT FROM p_code_hash THEN
        UPDATE public.user_identities
        SET linking_attempts = linking_attempts + 1,
            updated_at = v_now
        WHERE id = v_identity.id
          AND firebase_uid IS NULL
          AND linking_status = 'PENDING';

        RETURN jsonb_build_object('status', 'invalid_code');
    END IF;

    UPDATE public.user_identities
    SET firebase_uid = p_firebase_uid,
        email_verified = true,
        linking_status = 'LINKED',
        linked_at = v_now,
        linking_token_hash = NULL,
        linking_token_expires_at = NULL,
        linking_attempts = 0,
        updated_at = v_now
    WHERE id = v_identity.id
      AND firebase_uid IS NULL
      AND linking_status = 'PENDING'
      AND linking_token_hash = p_code_hash
      AND linking_token_expires_at > v_now
      AND linking_attempts < 5;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    IF v_updated_rows <> 1 THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    INSERT INTO public.account_linking_audit (
        internal_user_id,
        firebase_uid,
        email,
        ip_address,
        user_agent
    )
    VALUES (
        v_identity.internal_user_id,
        p_firebase_uid,
        v_identity.email,
        p_ip_address,
        p_user_agent
    );

    RETURN jsonb_build_object(
        'status', 'linked',
        'internal_user_id', v_identity.internal_user_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_account_linking(
    VARCHAR(128), VARCHAR(255), VARCHAR(64), VARCHAR(45), TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_account_linking(
    VARCHAR(128), VARCHAR(255), VARCHAR(64), VARCHAR(45), TEXT
) TO service_role;

COMMIT;
