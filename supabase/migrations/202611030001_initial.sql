create table public.documents (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 version integer not null default 1,
 payload jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy "Read own documents" on public.documents for select to authenticated using (owner_id = auth.uid());
-- Writes only through the version-checking RPC, never directly from clients.
revoke insert, update, delete on public.documents from anon, authenticated;
grant select on public.documents to authenticated;
create table public.sync_operations (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 document_id uuid not null, result jsonb not null, created_at timestamptz not null default now()
);
alter table public.sync_operations enable row level security;
revoke all on public.sync_operations from anon, authenticated;
create or replace function public.sync_document(p_operation_id uuid, p_id uuid, p_base_version integer, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); existing public.documents; previous public.sync_operations; result jsonb; next_version integer;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_payload->>'id' is distinct from p_id::text or p_payload->>'ownerId' is distinct from uid::text then raise exception 'Invalid document owner'; end if;
 if pg_column_size(p_payload) > 2097152 then raise exception 'Document too large'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
 select * into previous from public.sync_operations where id=p_operation_id;
 if found then
  if previous.owner_id<>uid or previous.document_id<>p_id then raise exception 'Invalid operation'; end if;
  return previous.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text, 1));
 select * into existing from public.documents where id=p_id for update;
 if found and existing.owner_id<>uid then raise exception 'Document unavailable'; end if;
 if (existing.id is not null and existing.version<>p_base_version) or (existing.id is null and p_base_version<>0) then
  if existing.id is null then raise exception 'Document unavailable'; end if;
  result=jsonb_build_object('conflict',true,'payload',existing.payload,'version',existing.version);
 else
  next_version=coalesce(existing.version,0)+1;
  insert into public.documents(id,owner_id,version,payload) values(p_id,uid,next_version,p_payload)
  on conflict(id) do update set version=next_version,payload=p_payload,updated_at=now();
  result=jsonb_build_object('conflict',false,'version',next_version);
 end if;
 insert into public.sync_operations(id,owner_id,document_id,result) values(p_operation_id,uid,p_id,result);
 return result;
end; $$;
revoke all on function public.sync_document(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.sync_document(uuid,uuid,integer,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('documents','documents',false,20971520,array['image/jpeg','application/pdf']) on conflict(id) do nothing;
create policy "Read own files" on storage.objects for select to authenticated using(bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Upload own files" on storage.objects for insert to authenticated with check(bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Update own files" on storage.objects for update to authenticated using(bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Delete own files" on storage.objects for delete to authenticated using(bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text);
create table public.ai_usage(owner_id uuid not null references auth.users(id) on delete cascade, day date not null, count integer not null, primary key(owner_id,day));
create table public.ai_requests(id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade, input_hash text not null, result jsonb, created_at timestamptz not null default now());
alter table public.ai_usage enable row level security;
alter table public.ai_requests enable row level security;
revoke all on public.ai_usage, public.ai_requests from anon,authenticated;
create or replace function public.reserve_ai(p_owner uuid,p_request uuid,p_hash text,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.ai_requests; used integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,2));
 select * into previous from public.ai_requests where id=p_request;
 if found then
  if previous.owner_id<>p_owner or previous.input_hash<>p_hash then raise exception 'Invalid request'; end if;
  return jsonb_build_object('cached',true,'result',previous.result);
 end if;
 insert into public.ai_usage(owner_id,day,count) values(p_owner,(now() at time zone 'utc')::date,1)
 on conflict(owner_id,day) do update set count=ai_usage.count+1 where ai_usage.count<p_limit returning count into used;
 if used is null then raise exception 'Daily AI limit reached'; end if;
 insert into public.ai_requests(id,owner_id,input_hash) values(p_request,p_owner,p_hash);
 return jsonb_build_object('cached',false);
end; $$;
revoke all on function public.reserve_ai(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_ai(uuid,uuid,text,integer) to service_role;
