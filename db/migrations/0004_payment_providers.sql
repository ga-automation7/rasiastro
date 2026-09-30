-- Payment providers: the UroPay Merchant API alongside Cashfree, and the provider
-- environment recorded on EVERY payment attempt.
--
-- An attempt is always checked, confirmed and reconciled through the provider and
-- environment saved here, never through whichever provider is currently active for
-- new checkouts. Historical rows are never rewritten to another provider.

alter table payments drop constraint if exists payments_provider_check;
alter table payments add constraint payments_provider_check check (provider in ('cashfree', 'uropay', 'demo'));

-- test / production = the provider's environment; demo = simulated (demo mode only).
alter table payments add column environment text;
update payments p
   set environment = case when p.provider = 'demo' then 'demo' when o.mode = 'live' then 'production' else 'test' end
  from orders o
 where o.id = p.order_id;
alter table payments alter column environment set not null;
alter table payments add constraint payments_environment_check check (environment in ('demo', 'test', 'production'));
alter table payments add constraint payments_demo_environment_check check ((provider = 'demo') = (environment = 'demo'));

-- The provider's own id for the order (Cashfree cf_order_id, UroPay order id), kept
-- separate from our reference (provider_order_id) and from our internal order id.
alter table payments add column provider_reference text;
-- UroPay: the hosted checkout URL, so an open checkout is reused instead of opening a second one.
alter table payments add column checkout_url text;

-- Reconciliation bookkeeping (shown on the admin dashboard; error codes only, never payloads).
alter table payments add column last_checked_at timestamptz;
alter table payments add column check_count integer not null default 0;
alter table payments add column last_check_error text;

create index payments_provider_env_idx on payments (provider, environment, created_at);
create index payments_open_idx on payments (status, last_checked_at) where status in ('created', 'pending', 'failed', 'cancelled');

alter table payment_events add column environment text;
