-- Phase 9-D: milestone gate metadata 확장

ALTER TABLE milestones
    ADD COLUMN IF NOT EXISTS type VARCHAR(20);

UPDATE milestones
SET type = 'DELIVERABLE'
WHERE type IS NULL;

ALTER TABLE milestones
    ALTER COLUMN type SET NOT NULL;

ALTER TABLE milestones
    ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE milestones
    ADD COLUMN IF NOT EXISTS readiness_note TEXT;

CREATE INDEX IF NOT EXISTS idx_milestones_owner_user
    ON milestones (owner_user_id);
