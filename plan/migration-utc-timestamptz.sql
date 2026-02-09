-- Normalize audit/expiry timestamps to UTC-based timestamptz.
-- Assumption: existing timestamp(without time zone) values are already UTC wall-clock values.
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name IN ('created_at', 'updated_at')
          AND data_type = 'timestamp without time zone'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
            col.table_name,
            col.column_name,
            col.column_name
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'refresh_tokens'
          AND column_name = 'expires_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        EXECUTE 'ALTER TABLE refresh_tokens ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE ''UTC''';
    END IF;
END $$;
