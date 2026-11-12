create or replace function public.reserve_ai(
  p_owner uuid,
  p_request uuid,
  p_hash text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  previous public.ai_requests;
  used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,2));
  select * into previous from public.ai_requests where id=p_request;
  if found then
    if previous.owner_id<>p_owner or previous.input_hash<>p_hash then
      raise exception 'Invalid request';
    end if;
    if previous.result is not null then
      return jsonb_build_object('cached',true,'result',previous.result);
    end if;
    return jsonb_build_object('cached',false,'retry',true);
  end if;
  insert into public.ai_usage(owner_id,day,count)
  values(p_owner,(now() at time zone 'utc')::date,1)
  on conflict(owner_id,day) do update
    set count=ai_usage.count+1
    where ai_usage.count<p_limit
  returning count into used;
  if used is null then raise exception 'Daily AI limit reached'; end if;
  insert into public.ai_requests(id,owner_id,input_hash)
  values(p_request,p_owner,p_hash);
  return jsonb_build_object('cached',false);
end;
$$;

revoke all on function public.reserve_ai(uuid,uuid,text,integer)
from public,anon,authenticated;
grant execute on function public.reserve_ai(uuid,uuid,text,integer)
to service_role;
