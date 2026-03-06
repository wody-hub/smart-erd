-- 다이어그램 리비전 컬럼 추가 (수동 실행용)
-- ddl-auto: update가 자동으로 컬럼을 생성하지만,
-- 기존 데이터의 snapshot_revision 초기화는 수동 실행이 필요하다.

ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS content_revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS snapshot_revision BIGINT NULL;
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS snapshot_updated_at TIMESTAMPTZ NULL;

-- 기존 스냅샷이 있는 다이어그램의 snapshot_revision을 content_revision으로 동기화
UPDATE diagrams SET snapshot_revision = content_revision
  WHERE ydoc_snapshot IS NOT NULL AND snapshot_revision IS NULL;
