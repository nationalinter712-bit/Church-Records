do $$
declare
  admin_user_id uuid;
  new_church_id uuid;
begin
  select id into admin_user_id
  from auth.users
  where lower(email) = lower('unlimitedtrialboss@gmail.com')
  limit 1;

  if admin_user_id is null then
    raise exception 'No Auth user found for unlimitedtrialboss@gmail.com. Create that user in Supabase Auth first.';
  end if;

  if exists (
    select 1 from public.church_memberships
    where user_id = admin_user_id and is_active
  ) then
    raise exception 'This user already has an active church membership. Stop here to avoid creating a duplicate church.';
  end if;

  insert into public.churches (name)
  values ('IHBC')
  returning id into new_church_id;

  insert into public.church_memberships (church_id, user_id, role)
  values (new_church_id, admin_user_id, 'owner');

  raise notice 'Created church % and assigned owner user %.', new_church_id, admin_user_id;
end $$;
