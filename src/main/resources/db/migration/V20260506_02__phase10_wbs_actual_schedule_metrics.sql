-- Phase 10-B: WBS actual schedule fields and derived progress metrics foundation

ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS actual_start_date DATE,
    ADD COLUMN IF NOT EXISTS actual_end_date DATE;
