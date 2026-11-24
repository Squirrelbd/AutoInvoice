-- =====================================================================
-- AutoInvoice Supabase Schema
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/oxbznvwhxjjkpklghmik/sql/new
-- =====================================================================

-- 1. Invoices Table
create table if not exists public.invoices (
  id text primary key,
  invoice_number text not null,
  biller_id text default 'biller_default',
  client_name text,
  date text,
  grand_total numeric default 0,
  status text default 'Saved',
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Challans Table
create table if not exists public.challans (
  id text primary key,
  challan_number text not null,
  biller_id text default 'biller_default',
  client_name text,
  date text,
  status text default 'Saved',
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Receipts Table
create table if not exists public.receipts (
  id text primary key,
  receipt_number text not null,
  invoice_number text,
  biller_id text default 'biller_default',
  amount numeric default 0,
  status text default 'Saved',
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Quotations Table
create table if not exists public.quotations (
  id text primary key,
  quotation_number text not null,
  biller_id text default 'biller_default',
  client_name text,
  grand_total numeric default 0,
  status text default 'Valid',
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Expenses Table
create table if not exists public.expenses (
  id text primary key,
  voucher_no text,
  biller_id text default 'biller_default',
  category text,
  amount numeric default 0,
  date text,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Clients Address Book
create table if not exists public.clients (
  id text primary key,
  name text not null,
  phone text,
  email text,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Items Catalog
create table if not exists public.items (
  id text primary key,
  name text not null,
  unit_price numeric default 0,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Billers Profiles
create table if not exists public.billers (
  id text primary key,
  name text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 9. Sequential Number Counters
create table if not exists public.sequences (
  key text primary key,
  year int not null,
  seq int not null,
  updated_at timestamptz default now()
);

-- Enable Row Level Security (RLS) on all tables
alter table public.invoices enable row level security;
alter table public.challans enable row level security;
alter table public.receipts enable row level security;
alter table public.quotations enable row level security;
alter table public.expenses enable row level security;
alter table public.clients enable row level security;
alter table public.items enable row level security;
alter table public.billers enable row level security;
alter table public.sequences enable row level security;

-- Policies allowing access via anon key (read, insert, update, delete)
drop policy if exists "Allow anon all on invoices" on public.invoices;
create policy "Allow anon all on invoices" on public.invoices for all to anon using (true) with check (true);

drop policy if exists "Allow anon all on challans" on public.challans;
create policy "Allow anon all on challans" on public.challans for all to anon using (true) with check (true);

drop policy if exists "Allow anon all on receipts" on public.receipts;
create policy "Allow anon all on receipts" on public.receipts for all to anon using (true) with check (true);

drop policy if exists "Allow anon all on quotations" on public.quotations;
create policy "Allow anon all on quotations" on public.quotations for all to anon using (true) with check (true);

drop policy if exists "Allow anon all on expenses" on public.expenses;
create policy "Allow anon all on expenses" on public.expenses for all to anon using (true) with check (true);

drop policy if exists "Allow anon all on clients" on public.clients;
create policy "Allow anon all on clients" on public.clients for all to anon using (true) with check (true);

drop policy if exists "Allow anon all on items" on public.items;
create policy "Allow anon all on items" on public.items for all to anon using (true) with check (true);

drop policy if exists "Allow anon all on billers" on public.billers;
create policy "Allow anon all on billers" on public.billers for all to anon using (true) with check (true);

drop policy if exists "Allow anon all on sequences" on public.sequences;
create policy "Allow anon all on sequences" on public.sequences for all to anon using (true) with check (true);
