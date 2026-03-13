ALTER TABLE diagrams
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN deleted_by VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_diagrams_project_deleted_at
    ON diagrams (project_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_diagrams_dictionary_set_deleted_at
    ON diagrams (dictionary_set_id, deleted_at);
