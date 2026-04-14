-- Phase 4: Project 사업 개요 컬럼 추가
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_company VARCHAR(200);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contractor_company VARCHAR(200);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_amount BIGINT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_scope TEXT;
