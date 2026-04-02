ALTER TABLE diagrams
    ADD COLUMN IF NOT EXISTS plugin_id VARCHAR(32);

UPDATE diagrams
SET plugin_id = 'erd'
WHERE plugin_id IS NULL;

ALTER TABLE diagrams
    ALTER COLUMN plugin_id SET DEFAULT 'erd';

ALTER TABLE diagrams
    ALTER COLUMN plugin_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diagrams_project_plugin_deleted_at
    ON diagrams (project_id, plugin_id, deleted_at);
