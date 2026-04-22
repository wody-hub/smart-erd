-- Phase 8: 문서 허브 목록 성능 최적화를 위한 summary 컬럼 추가
ALTER TABLE diagrams ADD COLUMN template_key VARCHAR(64);
ALTER TABLE diagrams ADD COLUMN summary_text VARCHAR(200);

-- 기존 markdown 문서의 content에서 template_key를 backfill
-- (frontmatter YAML 파싱은 애플리케이션 레벨에서 수행하므로 여기서는 정규식 기반 추출)
UPDATE diagrams
SET template_key = regexp_replace(
    substring(content FROM 'template:\s*([a-z\-]+)'),
    '^\s+|\s+$', '', 'g'
)
WHERE plugin_id = 'markdown'
  AND content IS NOT NULL
  AND content LIKE '%template:%';

-- summary_text backfill은 SQL로 수행하지 않는다.
-- markdown body에서 첫 비헤딩 텍스트를 추출하는 로직은 애플리케이션 레벨에서 처리하며,
-- 기존 문서는 다음 저장 시 SaveDiagramAuthoritativeContentUseCase가 자동으로 채운다.
