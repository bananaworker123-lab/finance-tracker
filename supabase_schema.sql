-- Run this in Supabase SQL Editor

create table categories (
  id bigint generated always as identity primary key,
  name text not null,
  emoji text,
  color text,
  type text
);

create table transactions (
  id bigint generated always as identity primary key,
  type text not null,
  amount numeric not null,
  category text,
  emoji text,
  tile text,
  date timestamptz not null,
  note text
);

create table installments (
  id bigint generated always as identity primary key,
  name text not null,
  emoji text,
  tile text,
  start_month text,
  due_day int,
  category text,
  note text,
  segments jsonb,
  total_installments int
);

create table bills (
  id bigint generated always as identity primary key,
  installment_id bigint references installments(id) on delete cascade,
  name text not null,
  emoji text,
  tile text,
  amount numeric not null,
  due_date timestamptz,
  category text,
  status text not null default 'upcoming',
  paid_date timestamptz,
  paid_amount numeric,
  note text,
  installment_index int
);

-- Disable RLS (ใช้งานส่วนตัว ไม่ต้องการ auth)
alter table categories disable row level security;
alter table transactions disable row level security;
alter table installments disable row level security;
alter table bills disable row level security;

-- Seed default categories
insert into categories (name, emoji, color, type) values
  ('Salary',        '💰', '#e3f3ec', 'income'),
  ('Freelance',     '💼', '#e8f0fe', 'income'),
  ('Business',      '🏢', '#f1ebfc', 'income'),
  ('Investment',    '📈', '#e3f3ec', 'income'),
  ('Bonus',         '⭐', '#fef9e3', 'income'),
  ('Rental',        '🏠', '#e7f4ec', 'income'),
  ('Gift',          '🎁', '#fdecef', 'income'),
  ('Other Income',  '💸', '#eef0ec', 'income'),
  ('Food',          '🍔', '#fbeede', 'expense'),
  ('Transport',     '🚕', '#e8f0fe', 'expense'),
  ('Shopping',      '🛍️', '#f1ebfc', 'expense'),
  ('Bills',         '⚡', '#e3f3ec', 'expense'),
  ('Entertainment', '🎬', '#fdecef', 'expense'),
  ('Health',        '💊', '#e8f0fe', 'expense'),
  ('Coffee',        '☕', '#f6ede2', 'expense'),
  ('Groceries',     '🛒', '#e7f4ec', 'expense'),
  ('Internet',      '📶', '#e3f3ec', 'expense'),
  ('Phone',         '📱', '#e8f0fe', 'expense'),
  ('Travel',        '✈️', '#e8f0fe', 'expense'),
  ('Credit Card',   '💳', '#f1ebfc', 'bill'),
  ('Education',     '📚', '#e8f0fe', 'bill'),
  ('Common Fee',    '🏢', '#e7f4ec', 'bill'),
  ('Vehicle',       '🚗', '#fbeede', 'bill'),
  ('Insurance',     '🛡️', '#e3f3ec', 'bill'),
  ('Other',         '💸', '#eef0ec', 'expense');
