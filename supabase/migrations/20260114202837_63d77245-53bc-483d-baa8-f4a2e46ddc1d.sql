-- Fix any project files that still have {{PROJECT_ID}} placeholder
-- This replaces the placeholder with the actual project_id for each file

UPDATE project_files
SET content = REPLACE(content, '{{PROJECT_ID}}', project_id::text)
WHERE content LIKE '%{{PROJECT_ID}}%';

-- Also create an index on project_form_submissions for faster queries
CREATE INDEX IF NOT EXISTS idx_project_form_submissions_project_id 
ON project_form_submissions(project_id);

CREATE INDEX IF NOT EXISTS idx_project_form_submissions_status 
ON project_form_submissions(status);