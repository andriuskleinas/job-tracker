-- Store the company's website so the application board can show a real logo
-- (via favicon) instead of guessing a domain from the company name.
alter table public.applications
  add column if not exists website text;
