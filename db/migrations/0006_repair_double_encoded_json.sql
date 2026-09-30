-- Repairs JSON values that the production driver stored twice-encoded.
--
-- The code sent JSON as text to a `$n::jsonb` parameter. postgres.js (Supabase) saw
-- the jsonb type and serialised the text AGAIN, so objects were stored as a JSON
-- string ("{...}") instead of an object ({...}). PGlite (local and tests) did not, so
-- only production was affected. The code now sends `$n::text::jsonb`.
--
-- Each statement only touches values that are a JSON string whose content is itself
-- a JSON object or array, so it is safe to run on already-correct data.

update orders set price_snapshot = (price_snapshot #>> '{}')::jsonb
 where jsonb_typeof(price_snapshot) = 'string' and left(price_snapshot #>> '{}', 1) in ('{', '[');

update payment_events set payload = (payload #>> '{}')::jsonb
 where jsonb_typeof(payload) = 'string' and left(payload #>> '{}', 1) in ('{', '[');

update outbox set payload = (payload #>> '{}')::jsonb
 where jsonb_typeof(payload) = 'string' and left(payload #>> '{}', 1) in ('{', '[');

update charts set conventions = (conventions #>> '{}')::jsonb
 where jsonb_typeof(conventions) = 'string' and left(conventions #>> '{}', 1) in ('{', '[');

update charts set settings = (settings #>> '{}')::jsonb
 where jsonb_typeof(settings) = 'string' and left(settings #>> '{}', 1) in ('{', '[');

update charts set data = (data #>> '{}')::jsonb
 where jsonb_typeof(data) = 'string' and left(data #>> '{}', 1) in ('{', '[');

update report_parts set content = (content #>> '{}')::jsonb
 where jsonb_typeof(content) = 'string' and left(content #>> '{}', 1) in ('{', '[');

update reports set content = (content #>> '{}')::jsonb
 where jsonb_typeof(content) = 'string' and left(content #>> '{}', 1) in ('{', '[');

update compatibility_analyses set data = (data #>> '{}')::jsonb
 where jsonb_typeof(data) = 'string' and left(data #>> '{}', 1) in ('{', '[');

update payments set checkout_data = (checkout_data #>> '{}')::jsonb
 where jsonb_typeof(checkout_data) = 'string' and left(checkout_data #>> '{}', 1) in ('{', '[');
