-- Owner-only admin dashboard: one-time sign-in codes and sessions.
--
-- Only people whose email is listed in ADMIN_EMAILS can sign in. Codes and session
-- tokens are stored as SHA-256 hashes only; the raw values exist in the owner's inbox
-- and browser cookie, never in the database.

create table admin_login_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index admin_login_codes_email_idx on admin_login_codes (email, created_at desc);

create table admin_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Server-only access, like every other table.
alter table admin_login_codes enable row level security;
alter table admin_sessions enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on admin_login_codes, admin_sessions from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on admin_login_codes, admin_sessions from authenticated';
  end if;
end
$$;
