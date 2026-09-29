-- Rasi Astro initial schema.
-- PostgreSQL is the source of truth for orders, payments, jobs and delivery.
-- Money is stored as integer paise (INR 49.00 = 4900).
-- Status columns are kept separate on purpose: payment, generation and delivery can
-- each fail and recover independently.

-- ---------------------------------------------------------------------------
-- Orders and their frozen inputs
-- ---------------------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^RA-[0-9A-Z]{8}$'),
  mode text not null check (mode in ('demo', 'live')),
  tradition text not null check (tradition in ('indian', 'western')),
  report_language text not null check (report_language in ('ta', 'en', 'hi', 'te', 'kn', 'ml')),
  package_code text not null check (package_code in ('report', 'report_with_questions')),
  pricing_version text not null,
  currency text not null check (currency = 'INR'),
  base_amount_paise integer not null check (base_amount_paise > 0),
  addon_amount_paise integer not null check (addon_amount_paise >= 0),
  total_amount_paise integer not null check (total_amount_paise = base_amount_paise + addon_amount_paise),
  price_snapshot jsonb not null,
  report_email text not null,
  -- Required by Cashfree to create a payment order; not used for marketing.
  payer_phone text,
  payment_status text not null default 'awaiting_payment'
    check (payment_status in ('awaiting_payment', 'pending', 'paid', 'failed', 'cancelled', 'expired', 'needs_review')),
  generation_status text not null default 'not_started'
    check (generation_status in ('not_started', 'queued', 'calculating', 'interpreting', 'rendering', 'ready', 'failed')),
  delivery_status text not null default 'not_sent'
    check (delivery_status in ('not_sent', 'sending', 'sent', 'failed')),
  consent_processing_at timestamptz not null,
  consent_version text not null,
  marketing_consent_at timestamptz,
  inputs_frozen_at timestamptz not null default now(),
  paid_at timestamptz,
  report_ready_at timestamptz,
  generation_failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delete_after timestamptz not null,
  -- Set when personal data was erased (retention or a deletion request); the order,
  -- amounts and payment references are kept as the financial record.
  personal_data_deleted_at timestamptz
);
create index orders_created_at_idx on orders (created_at desc);
create index orders_report_email_idx on orders (lower(report_email));
create index orders_delete_after_idx on orders (delete_after);
create index orders_payment_status_idx on orders (payment_status, created_at);

create table birth_details (
  order_id uuid primary key references orders (id) on delete cascade,
  subject_name text not null,
  birth_date date not null,
  time_certainty text not null check (time_certainty in ('exact', 'approximate', 'unknown')),
  birth_time_local time,
  time_window_minutes integer check (time_window_minutes in (15, 30, 60, 120, 180)),
  place_id text not null,
  place_name text not null,
  place_region text,
  place_country_code text not null,
  place_country_name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  timezone_id text not null,
  -- UTC offset in force at the birth moment (or at local noon when the time is unknown).
  utc_offset_seconds integer not null,
  -- Null when the birth time is unknown: we never invent a birth moment.
  birth_utc timestamptz,
  offset_resolution text not null check (offset_resolution in ('unique', 'dst_overlap_earlier', 'dst_overlap_later', 'date_only')),
  tz_database_version text,
  check ((time_certainty = 'unknown') = (birth_time_local is null)),
  check ((time_certainty = 'unknown') = (birth_utc is null)),
  check ((time_certainty = 'approximate') = (time_window_minutes is not null))
);

-- Customer-supplied, unverified context. Never overrides calculated chart data.
create table order_context (
  order_id uuid primary key references orders (id) on delete cascade,
  known_moon_sign text,
  known_nakshatra text,
  known_pada smallint check (known_pada between 1 and 4),
  known_ascendant text,
  other_known_details text,
  additional_context text
);

create table order_questions (
  order_id uuid not null references orders (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  question text not null,
  primary key (order_id, position)
);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  provider text not null check (provider in ('cashfree', 'demo')),
  provider_order_id text not null unique,
  attempt integer not null check (attempt >= 1),
  amount_paise integer not null check (amount_paise > 0),
  currency text not null,
  status text not null default 'created'
    check (status in ('created', 'pending', 'paid', 'failed', 'cancelled', 'expired', 'needs_review')),
  payment_session_id text,
  provider_payment_id text,
  provider_status text,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  verified_at timestamptz,
  unique (order_id, attempt)
);
-- At most one successful payment can ever be attached to an order.
create unique index payments_one_paid_per_order on payments (order_id) where status = 'paid';
create index payments_status_idx on payments (status, created_at);

-- Every provider notification we receive (after signature checks), deduplicated.
create table payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  dedupe_key text not null unique,
  event_type text not null,
  provider_order_id text,
  provider_payment_id text,
  payment_status text,
  amount_paise integer,
  currency text,
  signature_verified boolean not null,
  -- Minimal, sanitised payload (no customer contact details).
  payload jsonb not null default '{}'::jsonb,
  outcome text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index payment_events_provider_order_idx on payment_events (provider_order_id);

-- ---------------------------------------------------------------------------
-- Durable work: outbox + report jobs
-- ---------------------------------------------------------------------------
-- Written in the same transaction as the payment confirmation, so a verified
-- payment can never exist without a record of the work it owes.
create table outbox (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('report.generate', 'report.deliver')),
  order_id uuid references orders (id) on delete cascade,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  dispatched_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index outbox_pending_idx on outbox (available_at) where dispatched_at is null;

create table report_jobs (
  order_id uuid primary key references orders (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0,
  current_step text,
  last_error_code text,
  last_error_message text,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index report_jobs_status_idx on report_jobs (status, updated_at);

-- ---------------------------------------------------------------------------
-- Report artefacts
-- ---------------------------------------------------------------------------
create table charts (
  order_id uuid primary key references orders (id) on delete cascade,
  provider text not null,
  provider_version text not null,
  calculation_version text not null,
  conventions jsonb not null,
  settings jsonb not null,
  data jsonb not null,
  is_fixture boolean not null default false,
  created_at timestamptz not null default now()
);

-- Each interpretation part is persisted as soon as it is generated so that a retry
-- never pays for the same AI call twice.
create table report_parts (
  order_id uuid not null references orders (id) on delete cascade,
  part text not null check (part in ('core', 'timeline', 'synthesis')),
  content jsonb not null,
  schema_version text not null,
  prompt_version text not null,
  provider text not null,
  model text not null,
  is_demo boolean not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now(),
  primary key (order_id, part)
);

create table reports (
  order_id uuid primary key references orders (id) on delete cascade,
  schema_version text not null,
  prompt_version text not null,
  language text not null,
  content jsonb not null,
  pdf_storage_key text,
  pdf_size_bytes integer,
  pdf_sha256 text,
  pdf_renderer text,
  pdf_rendered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders (id) on delete set null,
  part text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  status text not null check (status in ('success', 'error', 'invalid_output', 'timeout', 'budget_exceeded')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer,
  estimated_cost_micro_usd integer,
  error_code text,
  created_at timestamptz not null default now()
);
create index ai_usage_created_at_idx on ai_usage (created_at);

-- ---------------------------------------------------------------------------
-- Delivery and access (no customer accounts)
-- ---------------------------------------------------------------------------
create table deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  kind text not null check (kind in ('report_ready', 'access_recovery')),
  dedupe_key text not null unique,
  provider text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index deliveries_order_idx on deliveries (order_id);

-- Only a SHA-256 hash of each access token is stored. The raw token exists in the
-- customer's email link / cookie and nowhere on our side.
create table access_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  issued_via text not null check (issued_via in ('checkout', 'report_email', 'recovery_email', 'owner')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index access_tokens_order_idx on access_tokens (order_id);

-- Fixed-window counters keyed by an HMAC of the IP / email (never the raw value).
create table rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket_key, window_start)
);

-- Funnel counts only. No birth data or report content is ever written here.
create table funnel_events (
  id bigserial primary key,
  event text not null check (event in ('form_started', 'checkout_started', 'payment_verified', 'report_ready', 'delivery_failed', 'generation_failed')),
  order_id uuid references orders (id) on delete set null,
  mode text not null check (mode in ('demo', 'live')),
  created_at timestamptz not null default now()
);
create index funnel_events_created_idx on funnel_events (created_at, event);

-- ---------------------------------------------------------------------------
-- Birthplace gazetteer (GeoNames, CC BY 4.0) used for coordinates + IANA time zone
-- ---------------------------------------------------------------------------
create table places (
  id text primary key,
  source text not null check (source in ('geonames', 'demo')),
  name text not null,
  ascii_name text not null,
  admin1 text,
  admin2 text,
  country_code text not null,
  country_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  timezone_id text not null,
  population integer not null default 0,
  feature_code text
);

create table place_names (
  place_id text not null references places (id) on delete cascade,
  name_norm text not null,
  primary key (place_id, name_norm)
);
create index place_names_prefix_idx on place_names (name_norm text_pattern_ops);

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------
-- The application talks to Postgres only from the server, with the database owner
-- role. Enabling row-level security with no policies means Supabase's public API
-- roles (anon / authenticated) can read or write nothing, even with the anon key.
alter table orders enable row level security;
alter table birth_details enable row level security;
alter table order_context enable row level security;
alter table order_questions enable row level security;
alter table payments enable row level security;
alter table payment_events enable row level security;
alter table outbox enable row level security;
alter table report_jobs enable row level security;
alter table charts enable row level security;
alter table report_parts enable row level security;
alter table reports enable row level security;
alter table ai_usage enable row level security;
alter table deliveries enable row level security;
alter table access_tokens enable row level security;
alter table rate_limits enable row level security;
alter table funnel_events enable row level security;
alter table places enable row level security;
alter table place_names enable row level security;
alter table schema_migrations enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
  end if;
end
$$;
