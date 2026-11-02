-- Shared, atomic initiation throttles for future verified account recovery.
-- Do not apply until tested in a disposable, non-production Supabase project.

BEGIN;

CREATE TABLE public.account_linking_rate_limits (
    scope TEXT NOT NULL CHECK (scope IN ('account', 'ip')),
    subject_hash VARCHAR(64) NOT NULL CHECK (subject_hash ~ '^[a-f0-9]{64}$'),
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (scope, subject_hash)
);

CREATE INDEX account_linking_rate_limits_updated_at_idx
    ON public.account_linking_rate_limits(updated_at);

ALTER TABLE public.account_linking_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_linking_rate_limits
    FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_account_linking_rate_limit(
    p_account_hash VARCHAR(64),
    p_ip_hash VARCHAR(64)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_account_count INTEGER;
    v_ip_count INTEGER;
BEGIN
    IF p_account_hash IS NULL OR p_account_hash !~ '^[a-f0-9]{64}$'
       OR p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN
        RETURN jsonb_build_object('status', 'invalid_request');
    END IF;

    INSERT INTO public.account_linking_rate_limits (
        scope, subject_hash, window_started_at, request_count, updated_at
    )
    VALUES ('account', p_account_hash, v_now, 1, v_now)
    ON CONFLICT (scope, subject_hash) DO UPDATE
    SET window_started_at = CASE
            WHEN public.account_linking_rate_limits.window_started_at <= v_now - INTERVAL '1 hour'
            THEN v_now
            ELSE public.account_linking_rate_limits.window_started_at
        END,
        request_count = CASE
            WHEN public.account_linking_rate_limits.window_started_at <= v_now - INTERVAL '1 hour'
            THEN 1
            ELSE public.account_linking_rate_limits.request_count + 1
        END,
        updated_at = v_now
    RETURNING request_count INTO v_account_count;

    INSERT INTO public.account_linking_rate_limits (
        scope, subject_hash, window_started_at, request_count, updated_at
    )
    VALUES ('ip', p_ip_hash, v_now, 1, v_now)
    ON CONFLICT (scope, subject_hash) DO UPDATE
    SET window_started_at = CASE
            WHEN public.account_linking_rate_limits.window_started_at <= v_now - INTERVAL '1 hour'
            THEN v_now
            ELSE public.account_linking_rate_limits.window_started_at
        END,
        request_count = CASE
            WHEN public.account_linking_rate_limits.window_started_at <= v_now - INTERVAL '1 hour'
            THEN 1
            ELSE public.account_linking_rate_limits.request_count + 1
        END,
        updated_at = v_now
    RETURNING request_count INTO v_ip_count;

    DELETE FROM public.account_linking_rate_limits
    WHERE (scope, subject_hash) IN (
        SELECT scope, subject_hash
        FROM public.account_linking_rate_limits
        WHERE updated_at < v_now - INTERVAL '1 day'
        ORDER BY updated_at
        LIMIT 1000
    );

    IF v_account_count > 3 OR v_ip_count > 10 THEN
        RETURN jsonb_build_object('status', 'rate_limited');
    END IF;

    RETURN jsonb_build_object('status', 'allowed');
END;
$$;

REVOKE ALL ON FUNCTION public.consume_account_linking_rate_limit(VARCHAR(64), VARCHAR(64))
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_account_linking_rate_limit(VARCHAR(64), VARCHAR(64))
    TO service_role;

COMMIT;
