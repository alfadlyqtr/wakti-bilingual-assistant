-- Allow admin users to delete contact submissions
CREATE POLICY "Admin users can delete contact submissions"
ON public.contact_submissions
FOR DELETE
USING (true);