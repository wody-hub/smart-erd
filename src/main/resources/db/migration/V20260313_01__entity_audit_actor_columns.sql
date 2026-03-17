-- 주요 비즈니스 엔티티 작성자/수정자 컬럼 추가
-- ddl-auto: update가 자동으로 컬럼을 생성할 수 있지만,
-- 기존 환경에 컬럼 존재를 명시적으로 맞추고 일부 사용자 데이터는 보정한다.

ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);

ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);

ALTER TABLE dictionary_sets ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE dictionary_sets ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);

ALTER TABLE domains ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);

ALTER TABLE terms ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE terms ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);

ALTER TABLE words ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE words ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);

-- 기존 사용자는 최소한 자기 loginId를 감사 작성자로 보정한다.
UPDATE users
SET created_by = login_id
WHERE created_by IS NULL;

UPDATE users
SET updated_by = COALESCE(updated_by, created_by, login_id)
WHERE updated_by IS NULL;
