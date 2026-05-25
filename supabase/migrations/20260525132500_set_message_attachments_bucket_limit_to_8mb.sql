UPDATE storage.buckets
SET file_size_limit = 8388608
WHERE id = 'message_attachments';
