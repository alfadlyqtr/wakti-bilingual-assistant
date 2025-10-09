-- One-time cleanup: Delete messy journal data for 2025-10-09
DELETE FROM journal_checkins 
WHERE user_id = '3100dea8-837e-49bd-a31c-9813626749b3' 
AND date = '2025-10-09';

DELETE FROM journal_days 
WHERE user_id = '3100dea8-837e-49bd-a31c-9813626749b3' 
AND date = '2025-10-09';