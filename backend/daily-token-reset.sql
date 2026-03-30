-- Use this only if the clinic workflow should restart token numbers every day.
-- The current database constraint makes token_number globally unique,
-- which conflicts with resetting the counter back to 1 on a new day.

-- Step 1: Remove the global uniqueness constraint.
alter table public.visits
drop constraint if exists visits_token_number_key;

-- Step 2: Keep token numbers unique within a single calendar day instead.
-- Adjust the timezone if the clinic should reset on a different local day.
create unique index if not exists visits_token_number_per_day_idx
on public.visits (
  token_number,
  ((created_at at time zone 'Asia/Kolkata')::date)
);
