-- Compatibility reports (two participants), per-product tracking and new declarations.
--
-- Backward compatible: every existing order becomes product 'personal' with a single
-- participant numbered 1, so existing queries, reports and exports keep working.

-- ---------------------------------------------------------------------------
-- Orders: product, category, declarations
-- ---------------------------------------------------------------------------
alter table orders add column product text not null default 'personal'
  check (product in ('personal', 'compatibility'));
alter table orders add column compatibility_category text
  check (compatibility_category in ('relationship', 'marriage', 'friendship', 'career_teamwork', 'business_partnership', 'family'));
alter table orders add constraint orders_category_matches_product
  check ((product = 'compatibility') = (compatibility_category is not null));

alter table orders drop constraint orders_package_code_check;
alter table orders add constraint orders_package_code_check
  check (package_code in ('report', 'report_with_questions', 'compatibility_pair'));
alter table orders add constraint orders_package_matches_product
  check ((product = 'compatibility') = (package_code = 'compatibility_pair'));

-- When the purchaser confirmed they are 18+, and (compatibility) that they have the
-- other person's permission. Null for orders placed before these declarations existed.
alter table orders add column adult_confirmed_at timestamptz;
alter table orders add column third_party_permission_at timestamptz;

create index orders_product_idx on orders (product, created_at desc);

-- ---------------------------------------------------------------------------
-- Participants: birth details and chart context become per participant
-- ---------------------------------------------------------------------------
alter table birth_details add column participant smallint not null default 1
  check (participant in (1, 2));
-- Stable identity for each participant record (exports, support, future features).
alter table birth_details add column participant_id uuid not null default gen_random_uuid();
alter table birth_details add constraint birth_details_participant_id_key unique (participant_id);
alter table birth_details drop constraint birth_details_pkey;
alter table birth_details add primary key (order_id, participant);

alter table order_context add column participant smallint not null default 1
  check (participant in (1, 2));
alter table order_context drop constraint order_context_pkey;
alter table order_context add primary key (order_id, participant);

-- Shared context for a compatibility order. Customer-provided, never "discovered".
create table compatibility_context (
  order_id uuid primary key references orders (id) on delete cascade,
  how_known text,
  known_duration text,
  hopes text,
  shared_circumstances text
);

-- ---------------------------------------------------------------------------
-- Charts per participant + the cross-chart analysis
-- ---------------------------------------------------------------------------
alter table charts add column participant smallint not null default 1
  check (participant in (1, 2));
alter table charts drop constraint charts_pkey;
alter table charts add primary key (order_id, participant);

create table compatibility_analyses (
  order_id uuid primary key references orders (id) on delete cascade,
  category text not null,
  tradition text not null check (tradition in ('indian', 'western')),
  calculation_version text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI parts for the compatibility report
-- ---------------------------------------------------------------------------
alter table report_parts drop constraint report_parts_part_check;
alter table report_parts add constraint report_parts_part_check
  check (part in ('core', 'timeline', 'synthesis', 'pair_core', 'pair_dynamics', 'pair_synthesis'));

-- ---------------------------------------------------------------------------
-- Per-product funnel counts and AI cost (no personal data)
-- ---------------------------------------------------------------------------
alter table funnel_events add column product text check (product in ('personal', 'compatibility'));
-- Copied at write time so cost per product survives order deletion (order_id is set null).
alter table ai_usage add column product text check (product in ('personal', 'compatibility'));

-- ---------------------------------------------------------------------------
-- Sandbox mode: the payment provider's TEST environment, no real money. Stored
-- separately from demo (simulated) and live (real money) orders.
-- ---------------------------------------------------------------------------
alter table orders drop constraint orders_mode_check;
alter table orders add constraint orders_mode_check check (mode in ('demo', 'sandbox', 'live'));
alter table funnel_events drop constraint funnel_events_mode_check;
alter table funnel_events add constraint funnel_events_mode_check check (mode in ('demo', 'sandbox', 'live'));

-- ---------------------------------------------------------------------------
-- Access control for the new tables (same rule as 0001: server-only access)
-- ---------------------------------------------------------------------------
alter table compatibility_context enable row level security;
alter table compatibility_analyses enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on compatibility_context, compatibility_analyses from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on compatibility_context, compatibility_analyses from authenticated';
  end if;
end
$$;
