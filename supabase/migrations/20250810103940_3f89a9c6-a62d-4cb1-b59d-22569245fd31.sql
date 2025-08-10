-- Add missing submission_type column to contact_submissions table
ALTER TABLE public.contact_submissions 
ADD COLUMN submission_type text NOT NULL DEFAULT 'contact';

-- Add index for better performance when filtering by submission type
CREATE INDEX idx_contact_submissions_submission_type ON public.contact_submissions(submission_type);

-- Add constraint to ensure valid submission types
ALTER TABLE public.contact_submissions 
ADD CONSTRAINT contact_submissions_submission_type_check 
CHECK (submission_type IN ('contact', 'feedback', 'abuse'));