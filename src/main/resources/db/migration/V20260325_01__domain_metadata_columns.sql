ALTER TABLE domains ADD COLUMN IF NOT EXISTS domain_group VARCHAR(100);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS domain_classification VARCHAR(100);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS data_type VARCHAR(50);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS data_length INTEGER;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS data_scale INTEGER;

UPDATE domains
SET
    data_type = COALESCE(
        data_type,
        NULLIF(UPPER(REGEXP_REPLACE(physical_type, '[[:space:]]*[(].*$', '')), '')
    ),
    data_length = COALESCE(
        data_length,
        CASE
            WHEN physical_type ~ '[(][[:space:]]*[0-9]+[[:space:]]*(,[[:space:]]*[0-9]+[[:space:]]*)?[)]$'
                THEN CAST(SUBSTRING(physical_type FROM '[(][[:space:]]*([0-9]+)') AS INTEGER)
            ELSE NULL
        END
    ),
    data_scale = COALESCE(
        data_scale,
        CASE
            WHEN physical_type ~ '[(][[:space:]]*[0-9]+[[:space:]]*,[[:space:]]*[0-9]+[[:space:]]*[)]$'
                THEN CAST(
                    SUBSTRING(physical_type FROM ',[[:space:]]*([0-9]+)[[:space:]]*[)]$') AS INTEGER
                )
            ELSE NULL
        END
    )
WHERE physical_type IS NOT NULL;
