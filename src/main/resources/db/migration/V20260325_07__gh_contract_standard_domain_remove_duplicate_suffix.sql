UPDATE public.domains d
SET logical_name = CASE
    WHEN UPPER(d.data_type) = 'VARCHAR' THEN
        CASE
            WHEN RIGHT(
                UPPER(REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')),
                LENGTH('_V' || COALESCE(d.data_length::text, ''))
            ) = UPPER('_V' || COALESCE(d.data_length::text, ''))
            THEN REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')
            ELSE REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')
                || '_V'
                || COALESCE(d.data_length::text, '')
        END
    WHEN UPPER(d.data_type) IN ('CHAR', 'CHARACTER') THEN
        CASE
            WHEN RIGHT(
                UPPER(REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')),
                LENGTH('_C' || COALESCE(d.data_length::text, ''))
            ) = UPPER('_C' || COALESCE(d.data_length::text, ''))
            THEN REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')
            ELSE REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')
                || '_C'
                || COALESCE(d.data_length::text, '')
        END
    WHEN UPPER(d.data_type) IN ('DECIMAL', 'NUMERIC') THEN
        CASE
            WHEN RIGHT(
                UPPER(REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')),
                LENGTH(
                    '_'
                    || UPPER(d.data_type)
                    || COALESCE(d.data_length::text, '')
                    || CASE
                        WHEN d.data_scale IS NOT NULL THEN '_' || d.data_scale::text
                        ELSE ''
                    END
                )
            ) = UPPER(
                '_'
                || UPPER(d.data_type)
                || COALESCE(d.data_length::text, '')
                || CASE
                    WHEN d.data_scale IS NOT NULL THEN '_' || d.data_scale::text
                    ELSE ''
                END
            )
            THEN REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')
            ELSE REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')
                || '_'
                || UPPER(d.data_type)
                || COALESCE(d.data_length::text, '')
                || CASE
                    WHEN d.data_scale IS NOT NULL THEN '_' || d.data_scale::text
                    ELSE ''
                END
        END
    ELSE REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')
END
FROM public.dictionary_sets ds
WHERE ds.id = d.dictionary_set_id
  AND ds.name = 'GH 도급'
  AND d.domain_classification IS NOT NULL
  AND d.data_type IS NOT NULL;
