UPDATE public.domains d
SET logical_name = REGEXP_REPLACE(d.domain_classification, '[[:space:]]+', '', 'g')
    || '_'
    || LEFT(UPPER(d.data_type), 1)
    || COALESCE(d.data_length::text, '')
    || CASE
        WHEN d.data_scale IS NOT NULL THEN '_' || d.data_scale::text
        ELSE ''
    END
FROM public.dictionary_sets ds
WHERE ds.id = d.dictionary_set_id
  AND ds.name = 'GH 도급'
  AND d.domain_classification IS NOT NULL
  AND d.data_type IS NOT NULL;
