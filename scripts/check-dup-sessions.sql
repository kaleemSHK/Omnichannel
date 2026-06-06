SELECT id, room_id, duration_ms, outcome, transport, customer_phone, metadata->>'callerName' AS caller
FROM call_sessions
WHERE id IN ('a47ca1c8-088a-4fa9-96a1-8b39787b4781', '8782b0f5-330d-4c7d-b7ba-6423ff0c7ced', '72ffc73b-9c14-475c-864e-0b49df9d903c');
