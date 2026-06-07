-- Remove SIP peer / mock short-extension CDR rows (e.g. "31", "42")
DELETE FROM call_sessions
WHERE TRIM(COALESCE(customer_phone, '')) ~ '^[0-9]{1,8}$';
