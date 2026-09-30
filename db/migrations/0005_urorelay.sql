-- UroRelay (UroPay's phone and SMS based UPI product), a DIFFERENT product from the
-- UroPay Merchant API ('uropay'). The customer pays a UPI QR code straight into the
-- owner's bank account; the UroPay Companion app on the owner's Android phone reads
-- the bank's UPI credit SMS and reports it. The customer's UPI reference number
-- (UTR) is unverified until that bank SMS confirms it.

alter table payments drop constraint if exists payments_provider_check;
alter table payments add constraint payments_provider_check check (provider in ('cashfree', 'uropay', 'urorelay', 'demo'));

-- Browser-safe checkout details shown on our own order page (UroRelay: the UPI QR
-- image and the upi:// payment link). Never contains credentials.
alter table payments add column checkout_data jsonb;

-- The UPI reference number the customer typed in. UNVERIFIED: it never marks a
-- payment paid by itself.
alter table payments add column submitted_reference text;
alter table payments add column reference_submitted_at timestamptz;
alter table payments add column reference_submissions integer not null default 0;

-- Set when the owner confirmed a payment by hand after checking the bank account.
alter table payments add column confirmed_by text;

-- A UPI reference can be claimed by one order only, and can pay one order only.
create unique index payments_submitted_reference_uniq on payments (provider, submitted_reference) where submitted_reference is not null;
create unique index payments_paid_reference_uniq on payments (provider_payment_id) where provider = 'urorelay' and status = 'paid' and provider_payment_id is not null;

-- Bank credits reported by the UroPay Companion app (signed webhooks). Only what is
-- needed to match a payment is kept: no payer name, no payer UPI ID.
create table relay_bank_credits (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'production')),
  reference_number text,
  amount_paise integer,
  uropay_order_id text,
  merchant_order_id text,
  detected_at timestamptz,
  -- The payment attempt UroPay matched this credit to (null = unmatched: the owner checks it).
  payment_id uuid references payments (id) on delete set null,
  received_at timestamptz not null default now()
);
-- One bank reference is one credit, however many times the notification is repeated.
create unique index relay_bank_credits_reference_uniq on relay_bank_credits (reference_number) where reference_number is not null;
create index relay_bank_credits_order_idx on relay_bank_credits (uropay_order_id);
create index relay_bank_credits_unmatched_idx on relay_bank_credits (received_at) where payment_id is null;

-- Server-only access, like every other table.
alter table relay_bank_credits enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on relay_bank_credits from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on relay_bank_credits from authenticated';
  end if;
end
$$;
