-- Allow 'support' as a valid submission type in contact_submissions
ALTER TABLE public.contact_submissions 
DROP CONSTRAINT IF EXISTS contact_submissions_submission_type_check;

ALTER TABLE public.contact_submissions 
ADD CONSTRAINT contact_submissions_submission_type_check 
CHECK (submission_type IN ('contact', 'feedback', 'abuse', 'support'));