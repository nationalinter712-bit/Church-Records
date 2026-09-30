create extension if not exists pgcrypto with schema extensions;

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.church_memberships (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'pastor', 'staff', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (church_id, user_id)
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  created_at timestamptz not null default now(),
  unique (id, church_id)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  family_id uuid,
  record_code text not null default ('CR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  email text check (email is null or length(email) <= 320),
  phone text check (phone is null or length(phone) <= 40),
  membership_status text not null default 'active' check (membership_status in ('active', 'visitor', 'inactive')),
  member_role text not null default 'Member' check (length(member_role) <= 80),
  joined_at date not null default current_date,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, church_id),
  unique (church_id, record_code),
  foreign key (family_id, church_id) references public.families(id, church_id) on delete restrict
);

create index members_church_name_idx on public.members (church_id, lower(last_name), lower(first_name)) where archived_at is null;
create index members_church_email_idx on public.members (church_id, lower(email)) where email is not null and archived_at is null;
create index members_family_idx on public.members (church_id, family_id) where archived_at is null;

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_date date not null,
  event_type text not null default 'Sunday gathering' check (length(event_type) between 1 and 100),
  notes text check (notes is null or length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, church_id)
);

create index attendance_events_church_date_idx on public.attendance_events (church_id, event_date desc);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  attendance_event_id uuid not null,
  member_id uuid not null,
  status text not null check (status in ('present', 'absent', 'excused')),
  recorded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (attendance_event_id, member_id),
  foreign key (attendance_event_id, church_id) references public.attendance_events(id, church_id) on delete cascade,
  foreign key (member_id, church_id) references public.members(id, church_id) on delete cascade
);

create index attendance_member_history_idx on public.attendance_records (church_id, member_id, attendance_event_id);

create table public.member_notes (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  member_id uuid not null,
  author_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  visibility text not null default 'administrators' check (visibility in ('administrators', 'pastoral')),
  content text not null check (length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  foreign key (member_id, church_id) references public.members(id, church_id) on delete cascade
);

create index member_notes_history_idx on public.member_notes (church_id, member_id, created_at desc);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  member_id uuid,
  storage_path text not null unique,
  original_file_name text not null check (length(original_file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 12582912),
  ocr_status text not null default 'pending' check (ocr_status in ('pending', 'processing', 'completed', 'failed', 'not_supported')),
  ocr_text text,
  ocr_error text check (ocr_error is null or length(ocr_error) <= 500),
  ocr_completed_at timestamptz,
  uploaded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (member_id, church_id) references public.members(id, church_id) on delete restrict
);

create index documents_church_created_idx on public.documents (church_id, created_at desc);

create or replace function public.has_church_role(target_church_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.church_memberships cm
    where cm.church_id = target_church_id
      and cm.user_id = (select auth.uid())
      and cm.is_active
      and cm.role = any (allowed_roles)
  );
$$;

revoke all on function public.has_church_role(uuid, text[]) from public, anon;
grant execute on function public.has_church_role(uuid, text[]) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_church_transfer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.church_id is distinct from old.church_id then
    raise exception 'A record cannot be moved between church workspaces';
  end if;
  return new;
end;
$$;

create trigger members_set_updated_at before update on public.members
for each row execute function public.set_updated_at();

create trigger families_prevent_church_transfer before update on public.families
for each row execute function public.prevent_church_transfer();
create trigger members_prevent_church_transfer before update on public.members
for each row execute function public.prevent_church_transfer();
create trigger attendance_events_prevent_church_transfer before update on public.attendance_events
for each row execute function public.prevent_church_transfer();
create trigger attendance_records_prevent_church_transfer before update on public.attendance_records
for each row execute function public.prevent_church_transfer();
create trigger documents_prevent_church_transfer before update on public.documents
for each row execute function public.prevent_church_transfer();

alter table public.churches enable row level security;
alter table public.church_memberships enable row level security;
alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_records enable row level security;
alter table public.member_notes enable row level security;
alter table public.documents enable row level security;

create policy "Church members can read their church"
on public.churches for select to authenticated
using (public.has_church_role(id, array['owner', 'admin', 'pastor', 'staff', 'viewer']));

create policy "Users can read their own memberships"
on public.church_memberships for select to authenticated
using (user_id = (select auth.uid()) or public.has_church_role(church_id, array['owner', 'admin']));

create policy "Church members can read families"
on public.families for select to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'pastor', 'staff', 'viewer']));
create policy "Authorized staff can create families"
on public.families for insert to authenticated
with check (public.has_church_role(church_id, array['owner', 'admin', 'staff']));
create policy "Authorized staff can update families"
on public.families for update to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'staff']))
with check (public.has_church_role(church_id, array['owner', 'admin', 'staff']));

create policy "Church members can read member profiles"
on public.members for select to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'pastor', 'staff', 'viewer']));
create policy "Authorized staff can create member profiles"
on public.members for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_church_role(church_id, array['owner', 'admin', 'staff'])
);
create policy "Authorized staff can update member profiles"
on public.members for update to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'staff']))
with check (public.has_church_role(church_id, array['owner', 'admin', 'staff']));

create policy "Church members can read attendance events"
on public.attendance_events for select to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'pastor', 'staff', 'viewer']));
create policy "Authorized staff can manage attendance events"
on public.attendance_events for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_church_role(church_id, array['owner', 'admin', 'staff'])
);
create policy "Authorized staff can update attendance events"
on public.attendance_events for update to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'staff']))
with check (public.has_church_role(church_id, array['owner', 'admin', 'staff']));

create policy "Church members can read attendance records"
on public.attendance_records for select to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'pastor', 'staff', 'viewer']));
create policy "Authorized staff can manage attendance records"
on public.attendance_records for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and public.has_church_role(church_id, array['owner', 'admin', 'staff'])
);
create policy "Authorized staff can update attendance records"
on public.attendance_records for update to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'staff']))
with check (public.has_church_role(church_id, array['owner', 'admin', 'staff']));

create policy "Admins and pastoral staff can read permitted notes"
on public.member_notes for select to authenticated
using (
  public.has_church_role(church_id, array['owner', 'admin'])
  or (visibility = 'pastoral' and public.has_church_role(church_id, array['pastor']))
);
create policy "Admins and pastoral staff can add notes"
on public.member_notes for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    (visibility = 'administrators' and public.has_church_role(church_id, array['owner', 'admin']))
    or (visibility = 'pastoral' and public.has_church_role(church_id, array['owner', 'admin', 'pastor']))
  )
);

create policy "Church staff can read document metadata"
on public.documents for select to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'pastor', 'staff']));
create policy "Authorized staff can upload document metadata"
on public.documents for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and public.has_church_role(church_id, array['owner', 'admin', 'staff'])
);
create policy "Authorized staff can update OCR metadata"
on public.documents for update to authenticated
using (public.has_church_role(church_id, array['owner', 'admin', 'staff']))
with check (public.has_church_role(church_id, array['owner', 'admin', 'staff']));

grant select on public.churches, public.church_memberships to authenticated;
grant select, insert, update on public.families, public.members to authenticated;
grant select, insert, update on public.attendance_events, public.attendance_records to authenticated;
grant select, insert on public.member_notes to authenticated;
grant select, insert, update on public.documents to authenticated;

create or replace function public.record_attendance_event(
  target_church_id uuid,
  target_event_date date,
  target_event_type text,
  present_member_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_event_id uuid;
begin
  if not public.has_church_role(target_church_id, array['owner', 'admin', 'staff']) then
    raise exception 'Not authorized to record attendance';
  end if;

  insert into public.attendance_events (church_id, event_date, event_type, created_by)
  values (target_church_id, target_event_date, trim(target_event_type), (select auth.uid()))
  returning id into created_event_id;

  insert into public.attendance_records (church_id, attendance_event_id, member_id, status, recorded_by)
  select target_church_id, created_event_id, member_id, 'present', (select auth.uid())
  from unnest(coalesce(present_member_ids, array[]::uuid[])) as attendees(member_id);

  return created_event_id;
end;
$$;

revoke all on function public.record_attendance_event(uuid, date, text, uuid[]) from public, anon;
grant execute on function public.record_attendance_event(uuid, date, text, uuid[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('church-documents', 'church-documents', false, 12582912, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Authorized staff can upload church documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'church-documents'
  and public.has_church_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'staff'])
  and exists (
    select 1 from public.members m
    where m.id = ((storage.foldername(name))[2])::uuid
      and m.church_id = ((storage.foldername(name))[1])::uuid
      and m.archived_at is null
  )
);

create policy "Church staff can read their private documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'church-documents'
  and public.has_church_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'pastor', 'staff'])
);

create policy "Admins can delete church documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'church-documents'
  and (
    public.has_church_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin'])
    or (owner_id = (select auth.uid())
      and public.has_church_role(((storage.foldername(name))[1])::uuid, array['staff']))
  )
);