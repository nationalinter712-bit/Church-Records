alter table public.members
  add column if not exists profile_details jsonb not null default '{}'::jsonb,
  add column if not exists profile_updated_at timestamptz;

create index if not exists members_profile_details_idx
  on public.members using gin (profile_details);

create or replace function public.normalize_member_profile_details()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.profile_details is null then
    new.profile_details = '{}'::jsonb;
  elsif jsonb_typeof(new.profile_details) <> 'object' then
    raise exception 'member profile details must be a JSON object';
  end if;

  new.profile_updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_normalize_profile_details on public.members;
create trigger members_normalize_profile_details
before insert or update on public.members
for each row
execute function public.normalize_member_profile_details();
