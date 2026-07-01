-- เพิ่ม table bill_templates
create table bill_templates (
  id bigint generated always as identity primary key,
  name text not null,
  emoji text,
  tile text,
  category text
);

alter table bill_templates disable row level security;

-- เพิ่ม template_id ใน bills
alter table bills add column template_id bigint references bill_templates(id) on delete set null;
