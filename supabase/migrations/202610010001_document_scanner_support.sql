alter table public.documents
  add column if not exists source text not null default 'upload' check (source in ('upload', 'scan')),
  add column if not exists scanned_at timestamptz;

create index if not exists documents_source_idx
  on public.documents (church_id, source, created_at desc);

create or replace function public.update_document_scan_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source = 'scan' and new.scanned_at is null then
    new.scanned_at = now();
  elsif new.source = 'upload' and new.scanned_at is not null and new.ocr_status = 'completed' then
    new.scanned_at = new.scanned_at;
  end if;

  return new;
end;
$$;

drop trigger if exists documents_set_scan_metadata on public.documents;
create trigger documents_set_scan_metadata
before insert or update on public.documents
for each row
execute function public.update_document_scan_metadata();
