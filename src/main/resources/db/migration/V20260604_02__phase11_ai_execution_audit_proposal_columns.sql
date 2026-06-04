ALTER TABLE ai_execution_audits
    ADD COLUMN proposal_id VARCHAR(80),
    ADD COLUMN action_type VARCHAR(80),
    ADD COLUMN risk_level VARCHAR(30),
    ADD COLUMN target_type VARCHAR(80),
    ADD COLUMN target_id VARCHAR(120),
    ADD COLUMN target_label VARCHAR(200),
    ADD COLUMN decision_by VARCHAR(50),
    ADD COLUMN decided_at TIMESTAMP;

CREATE INDEX idx_ai_execution_audits_proposal_id
    ON ai_execution_audits (proposal_id);
