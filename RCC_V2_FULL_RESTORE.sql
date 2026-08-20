
/* =========================================================
   RCC V2 - FULL RESTORE / ONE SQL
   Backend RPC untuk frontend RCC V2
   NON-DESTRUCTIVE TERHADAP DATA:
   - tidak DROP TABLE
   - tidak DELETE data
   - tidak INSERT data test
   ========================================================= */

begin;

/* ---------- INDEX ---------- */
create index if not exists idx_dokumen_pv on public.dokumen(nomor_pv);
create index if not exists idx_dokumen_vendor on public.dokumen(nama_vendor);
create index if not exists idx_dokumen_box on public.dokumen(box_id);
create index if not exists idx_dokumen_kode on public.dokumen(kode);
create index if not exists idx_boxes_nomor on public.boxes(nomor_box);

/* ---------- DASHBOARD ---------- */
drop function if exists public.rcc_stats();
create function public.rcc_stats()
returns table(
  total_dokumen bigint,
  sudah_terhubung bigint,
  belum_terhubung bigint,
  total_box bigint
)
language sql stable security definer set search_path=public
as $$
  select
    count(*)::bigint,
    count(d.box_id)::bigint,
    (count(*)-count(d.box_id))::bigint,
    (select count(*)::bigint from public.boxes)
  from public.dokumen d;
$$;

/* ---------- SEARCH ---------- */
drop function if exists public.search_rcc(text);
create function public.search_rcc(search_term text)
returns table(
  dokumen_id bigint,
  nomor_pv text,
  nama_vendor text,
  tahun text,
  kode text,
  nomor_box text,
  rak text,
  lemari text,
  roll_o_pack text,
  status_box text
)
language sql stable security definer set search_path=public
as $$
  select d.dokumen_id,d.nomor_pv,d.nama_vendor,d.tahun,d.kode,
         d.nomor_box,d.rak,d.lemari,d.roll_o_pack,b.status
  from public.dokumen d
  left join public.boxes b on b.box_id=d.box_id
  where
       coalesce(d.nomor_pv,'') ilike '%'||coalesce(search_term,'')||'%'
    or coalesce(d.nama_vendor,'') ilike '%'||coalesce(search_term,'')||'%'
    or coalesce(d.nomor_box,'') ilike '%'||coalesce(search_term,'')||'%'
    or coalesce(d.kode,'') ilike '%'||coalesce(search_term,'')||'%'
    or coalesce(d.rak,'') ilike '%'||coalesce(search_term,'')||'%'
    or coalesce(d.lemari,'') ilike '%'||coalesce(search_term,'')||'%'
  order by d.nomor_pv,d.dokumen_id
  limit 100;
$$;

/* ---------- BOX LIST ---------- */
drop function if exists public.rcc_box_list(text);
create function public.rcc_box_list(p_search text default '')
returns table(
  box_id bigint,
  nomor_box text,
  roll_o_pack text,
  rak text,
  lemari text,
  status_box text,
  jumlah_dokumen bigint
)
language sql stable security definer set search_path=public
as $$
  select b.box_id,b.nomor_box,b.roll_o_pack,b.rak,b.lemari,b.status,
         count(d.dokumen_id)::bigint
  from public.boxes b
  left join public.dokumen d on d.box_id=b.box_id
  where
       nullif(trim(coalesce(p_search,'')),'') is null
    or b.nomor_box ilike '%'||trim(p_search)||'%'
    or b.rak ilike '%'||trim(p_search)||'%'
    or b.lemari ilike '%'||trim(p_search)||'%'
    or b.roll_o_pack ilike '%'||trim(p_search)||'%'
  group by b.box_id,b.nomor_box,b.roll_o_pack,b.rak,b.lemari,b.status
  order by b.lemari,b.rak,b.nomor_box;
$$;

/* ---------- BOX CONTENT ---------- */
drop function if exists public.rcc_box_documents(bigint);
create function public.rcc_box_documents(p_box_id bigint)
returns table(
  dokumen_id bigint,
  nomor_pv text,
  nama_vendor text,
  tahun text,
  kode text,
  nomor_box text,
  roll_o_pack text,
  rak text,
  lemari text
)
language sql stable security definer set search_path=public
as $$
  select d.dokumen_id,d.nomor_pv,d.nama_vendor,d.tahun,d.kode,
         d.nomor_box,d.roll_o_pack,d.rak,d.lemari
  from public.dokumen d
  where d.box_id=p_box_id
  order by d.nomor_pv,d.dokumen_id;
$$;

/* ---------- BOX OPTIONS ---------- */
drop function if exists public.rcc_box_options();
create function public.rcc_box_options()
returns table(
  box_id bigint,
  nomor_box text,
  roll_o_pack text,
  rak text,
  lemari text,
  status_box text,
  jumlah_dokumen bigint
)
language sql stable security definer set search_path=public
as $$
  select * from public.rcc_box_list('');
$$;

/* ---------- ADD BOX ---------- */
drop function if exists public.add_rcc_box(text,text,text,text,text);
create function public.add_rcc_box(
  p_nomor_box text,
  p_roll_o_pack text,
  p_rak text,
  p_lemari text,
  p_status text default 'TERSEDIA'
)
returns json
language plpgsql security definer set search_path=public
as $$
declare v_id bigint;
begin
  if nullif(trim(coalesce(p_nomor_box,'')),'') is null then
    return json_build_object('ok',false,'message','Nomor Box wajib diisi');
  end if;

  insert into public.boxes(nomor_box,roll_o_pack,rak,lemari,status)
  values(trim(p_nomor_box),nullif(trim(p_roll_o_pack),''),nullif(trim(p_rak),''),
         nullif(trim(p_lemari),''),coalesce(nullif(trim(p_status),''),'TERSEDIA'))
  on conflict(nomor_box,roll_o_pack,lemari,rak)
  do update set status=excluded.status
  returning box_id,nomor_box into v_id,p_nomor_box;

  return json_build_object('ok',true,'box_id',v_id,'nomor_box',p_nomor_box);
end;
$$;

/* ---------- ADD DOCUMENT ---------- */
drop function if exists public.add_rcc_document(text,text,integer,text,bigint);
create function public.add_rcc_document(
  p_nomor_pv text,
  p_nama_vendor text,
  p_tahun integer,
  p_kode text,
  p_box_id bigint default null
)
returns json
language plpgsql security definer set search_path=public
as $$
declare v_id bigint;
begin
  if nullif(trim(coalesce(p_nomor_pv,'')),'') is null then
    return json_build_object('ok',false,'message','Nomor PV wajib diisi');
  end if;
  if nullif(trim(coalesce(p_nama_vendor,'')),'') is null then
    return json_build_object('ok',false,'message','Nama vendor wajib diisi');
  end if;

  if exists(
    select 1 from public.dokumen
    where nomor_pv=trim(p_nomor_pv)
      and coalesce(nama_vendor,'')=coalesce(trim(p_nama_vendor),'')
      and coalesce(tahun,'')=coalesce(p_tahun::text,'')
      and coalesce(kode,'')=coalesce(trim(p_kode),'')
      and coalesce(box_id,-1)=coalesce(p_box_id,-1)
  ) then
    return json_build_object('ok',false,'duplicate',true,'message','Record yang sama sudah ada');
  end if;

  insert into public.dokumen(
    nomor_pv,nama_vendor,tahun,kode,box_id,nomor_box,roll_o_pack,rak,lemari
  )
  select
    trim(p_nomor_pv),trim(p_nama_vendor),p_tahun::text,trim(coalesce(p_kode,'')),
    p_box_id,b.nomor_box,b.roll_o_pack,b.rak,b.lemari
  from public.boxes b
  where b.box_id=p_box_id
  union all
  select trim(p_nomor_pv),trim(p_nama_vendor),p_tahun::text,trim(coalesce(p_kode,'')),
         null,null,null,null,null
  where p_box_id is null
  returning dokumen_id into v_id;

  return json_build_object('ok',true,'dokumen_id',v_id);
end;
$$;

/* ---------- IMPORT CSV / BULK PASTE ---------- */
drop function if exists public.import_rcc_documents(jsonb);
create function public.import_rcc_documents(p_rows jsonb)
returns json
language plpgsql security definer set search_path=public
as $$
declare
  r jsonb;
  ins int:=0; dup int:=0; invalid int:=0; errors int:=0;
  v_pv text; v_vendor text; v_year text; v_kode text; v_box text;
  v_box_id bigint;
  v_match_count int;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
  loop
    v_pv:=nullif(trim(coalesce(r->>'nomor_pv','')),'');
    v_vendor:=nullif(trim(coalesce(r->>'nama_vendor','')),'');
    v_year:=trim(coalesce(r->>'tahun',''));
    v_kode:=trim(coalesce(r->>'kode',''));
    v_box:=nullif(trim(coalesce(r->>'nomor_box','')),'');

    if v_pv is null or v_vendor is null or v_year !~ '^[0-9]{4}$' then
      invalid:=invalid+1; continue;
    end if;

    v_box_id:=null;
    if v_box is not null then
      select count(*) into v_match_count
      from public.boxes b
      where b.nomor_box=v_box;

      if v_match_count=1 then
        select b.box_id into v_box_id from public.boxes b where b.nomor_box=v_box limit 1;
      end if;
    end if;

    if exists(
      select 1 from public.dokumen d
      where d.nomor_pv=v_pv
        and coalesce(d.nama_vendor,'')=coalesce(v_vendor,'')
        and coalesce(d.tahun,'')=v_year
        and coalesce(d.kode,'')=coalesce(v_kode,'')
        and coalesce(d.nomor_box,'')=coalesce(v_box,'')
    ) then
      dup:=dup+1; continue;
    end if;

    begin
      insert into public.dokumen(
        nomor_pv,nama_vendor,tahun,kode,nomor_box,roll_o_pack,rak,lemari,box_id
      )
      select v_pv,v_vendor,v_year,v_kode,b.nomor_box,b.roll_o_pack,b.rak,b.lemari,b.box_id
      from public.boxes b where b.box_id=v_box_id
      union all
      select v_pv,v_vendor,v_year,v_kode,v_box,null,null,null,null
      where v_box_id is null;

      ins:=ins+1;
    exception when others then
      errors:=errors+1;
    end;
  end loop;

  return json_build_object('inserted',ins,'duplicates',dup,'invalid',invalid,'errors',errors);
end;
$$;

/* ---------- CHECK BULK PASTE ---------- */
drop function if exists public.check_rcc_documents(jsonb);
create function public.check_rcc_documents(p_rows jsonb)
returns table(
  row_no int,
  nomor_pv text,
  nama_vendor text,
  tahun text,
  kode text,
  nomor_box text,
  status text,
  message text
)
language plpgsql stable security definer set search_path=public
as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
  loop
    nomor_pv:=trim(coalesce(r->>'nomor_pv',''));
    nama_vendor:=trim(coalesce(r->>'nama_vendor',''));
    tahun:=trim(coalesce(r->>'tahun',''));
    kode:=trim(coalesce(r->>'kode',''));
    nomor_box:=trim(coalesce(r->>'nomor_box',''));
    row_no:=coalesce((r->>'_row')::int,0);

    if nomor_pv='' or nama_vendor='' then
      status:='INVALID'; message:='PV dan vendor wajib diisi'; return next; continue;
    end if;

    if tahun !~ '^[0-9]{4}$' then
      status:='INVALID'; message:='Tahun harus 4 digit'; return next; continue;
    end if;

    if nomor_box<>'' and not exists(select 1 from public.boxes b where b.nomor_box=nomor_box) then
      status:='INVALID'; message:='Nomor Box tidak ditemukan'; return next; continue;
    end if;

    if exists(
      select 1 from public.dokumen d
      where d.nomor_pv=nomor_pv
        and coalesce(d.nama_vendor,'')=nama_vendor
        and coalesce(d.tahun,'')=tahun
        and coalesce(d.kode,'')=kode
        and coalesce(d.nomor_box,'')=nomor_box
    ) then
      status:='DUPLICATE'; message:='Record yang sama sudah ada'; return next; continue;
    end if;

    status:='READY'; message:='Siap diimport'; return next;
  end loop;
end;
$$;

/* ---------- PV DETAIL ---------- */
drop function if exists public.rcc_pv_detail(text);
create function public.rcc_pv_detail(p_search text)
returns table(
  dokumen_id bigint, nomor_pv text, nama_vendor text, tahun text,
  nomor_box text, roll_o_pack text, rak text, lemari text,
  kode text, box_id bigint, status_box text
)
language sql stable security definer set search_path=public
as $$
  select d.dokumen_id,d.nomor_pv,d.nama_vendor,d.tahun,d.nomor_box,
         d.roll_o_pack,d.rak,d.lemari,d.kode,d.box_id,b.status
  from public.dokumen d
  left join public.boxes b on b.box_id=d.box_id
  where d.nomor_pv ilike '%'||coalesce(p_search,'')||'%'
  order by d.dokumen_id;
$$;

/* ---------- VISUAL CENTER ---------- */
drop function if exists public.rcc_visual_center();
create function public.rcc_visual_center()
returns table(
  box_id bigint, nomor_box text, roll_o_pack text, lemari text,
  rak text, status text, jumlah_dokumen bigint
)
language sql stable security definer set search_path=public
as $$
  select b.box_id,b.nomor_box,b.roll_o_pack,b.lemari,b.rak,b.status,
         count(d.dokumen_id)::bigint
  from public.boxes b
  left join public.dokumen d on d.box_id=b.box_id
  group by b.box_id,b.nomor_box,b.roll_o_pack,b.lemari,b.rak,b.status
  order by b.lemari,b.rak,b.nomor_box;
$$;

/* ---------- COMPATIBILITY DETAIL FUNCTIONS ---------- */
drop function if exists public.box_detail(text);
create function public.box_detail(box_number text)
returns table(
  nomor_box text, roll_o_pack text, rak text, lemari text,
  status_box text, nomor_pv text, nama_vendor text, tahun text, kode text
)
language sql stable security definer set search_path=public
as $$
  select b.nomor_box,b.roll_o_pack,b.rak,b.lemari,b.status,
         d.nomor_pv,d.nama_vendor,d.tahun,d.kode
  from public.boxes b
  left join public.dokumen d on d.box_id=b.box_id
  where b.nomor_box=box_number
  order by d.nomor_pv;
$$;

drop function if exists public.pv_detail(text);
create function public.pv_detail(p_pv text)
returns table(
  dokumen_id bigint, nomor_pv text, nama_vendor text, tahun text,
  nomor_box text, roll_o_pack text, rak text, lemari text,
  kode text, box_id bigint
)
language sql stable security definer set search_path=public
as $$
  select d.dokumen_id,d.nomor_pv,d.nama_vendor,d.tahun,d.nomor_box,
         d.roll_o_pack,d.rak,d.lemari,d.kode,d.box_id
  from public.dokumen d where d.nomor_pv=p_pv
  order by d.dokumen_id;
$$;

/* ---------- REQUEST ---------- */
alter table public.rcc_requests add column if not exists notes text;

drop function if exists public.rcc_request_list(text,text);
create function public.rcc_request_list(p_search text default '',p_status text default '')
returns table(
  request_id bigint, created_at timestamptz, user_name text,
  payment_voucher text, kode text, vendor text, status text, notes text
)
language sql stable security definer set search_path=public
as $$
  select r.request_id,r.created_at,r.user_name,r.payment_voucher,
         r.kode,r.vendor,r.status,r.notes
  from public.rcc_requests r
  where
    (nullif(trim(p_search),'') is null
      or coalesce(r.payment_voucher,'') ilike '%'||trim(p_search)||'%'
      or coalesce(r.vendor,'') ilike '%'||trim(p_search)||'%'
      or coalesce(r.user_name,'') ilike '%'||trim(p_search)||'%')
    and (nullif(trim(p_status),'') is null or r.status=trim(p_status))
  order by r.created_at desc;
$$;

drop function if exists public.rcc_request_create(text,text,text,text,text);
create function public.rcc_request_create(
  p_user_name text,payment_voucher text,p_kode text,p_vendor text,p_notes text
)
returns json
language plpgsql security definer set search_path=public
as $$
declare rid bigint;
begin
  insert into public.rcc_requests(user_name,payment_voucher,kode,vendor,status,notes)
  values(trim(p_user_name),trim(payment_voucher),trim(p_kode),trim(p_vendor),'REQUESTED',trim(p_notes))
  returning request_id into rid;
  return json_build_object('ok',true,'request_id',rid);
end;
$$;

/* ---------- REJECT ---------- */
alter table public.rcc_rejects add column if not exists dokumen_id bigint;
alter table public.rcc_rejects add column if not exists nomor_pv text;
alter table public.rcc_rejects add column if not exists nama_vendor text;
alter table public.rcc_rejects add column if not exists tahun text;
alter table public.rcc_rejects add column if not exists nomor_box text;
alter table public.rcc_rejects add column if not exists rak text;
alter table public.rcc_rejects add column if not exists lemari text;
alter table public.rcc_rejects add column if not exists reviewer text;
alter table public.rcc_rejects add column if not exists alasan text;
alter table public.rcc_rejects add column if not exists status text default 'OPEN';
alter table public.rcc_rejects add column if not exists tanggal_reject date;
alter table public.rcc_rejects add column if not exists user_reject text;

drop function if exists public.rcc_create_reject_manual(date,text,text,text,text);
create function public.rcc_create_reject_manual(
  p_tanggal date,p_nama_vendor text,p_user text,p_alasan text,p_nomor_pv text default null
)
returns json
language plpgsql security definer set search_path=public
as $$
declare
  v_dokumen_id bigint:=null;
  v_doc_pv text:=null;
  v_doc_vendor text:=null;
  v_tahun text:=null;
  v_nomor_box text:=null;
  v_rak text:=null;
  v_lemari text:=null;
  rid bigint;
begin
  if nullif(trim(coalesce(p_nomor_pv,'')),'') is not null then
    select d.dokumen_id,d.nomor_pv,d.nama_vendor,d.tahun,b.nomor_box,b.rak,b.lemari
    into v_dokumen_id,v_doc_pv,v_doc_vendor,v_tahun,v_nomor_box,v_rak,v_lemari
    from public.dokumen d
    left join public.boxes b on b.box_id=d.box_id
    where d.nomor_pv=trim(p_nomor_pv)
    order by d.dokumen_id limit 1;
  end if;

  if nullif(trim(coalesce(p_nama_vendor,'')),'') is null and v_doc_vendor is null then
    raise exception 'Nama vendor wajib diisi';
  end if;
  if nullif(trim(coalesce(p_user,'')),'') is null then
    raise exception 'User / reviewer wajib diisi';
  end if;
  if nullif(trim(coalesce(p_alasan,'')),'') is null then
    raise exception 'Alasan reject wajib diisi';
  end if;

  insert into public.rcc_rejects(
    dokumen_id,nomor_pv,nama_vendor,tahun,nomor_box,rak,lemari,
    reviewer,alasan,status,tanggal_reject,user_reject
  )
  values(
    v_dokumen_id,coalesce(v_doc_pv,trim(p_nomor_pv),'MANUAL'),
    coalesce(nullif(trim(p_nama_vendor),''),v_doc_vendor),
    v_tahun,v_nomor_box,v_rak,v_lemari,trim(p_user),trim(p_alasan),
    'OPEN',coalesce(p_tanggal,current_date),trim(p_user)
  )
  returning reject_id into rid;

  return json_build_object('ok',true,'reject_id',rid);
end;
$$;

drop function if exists public.rcc_reject_list(text,text);
create function public.rcc_reject_list(p_search text default '',p_status text default '')
returns table(
  reject_id bigint, nomor_pv text, nama_vendor text, tahun text,
  nomor_box text, rak text, lemari text, reviewer text, alasan text,
  status text, created_at timestamptz, resolved_at timestamptz,
  tanggal_reject date, user_reject text
)
language sql stable security definer set search_path=public
as $$
  select r.reject_id,r.nomor_pv,r.nama_vendor,r.tahun,r.nomor_box,r.rak,r.lemari,
         r.reviewer,r.alasan,r.status,r.created_at,
         case when to_regclass('public.rcc_rejects') is not null
              then null::timestamptz else null::timestamptz end,
         r.tanggal_reject,r.user_reject
  from public.rcc_rejects r
  where
    (nullif(trim(p_search),'') is null
      or coalesce(r.nomor_pv,'') ilike '%'||trim(p_search)||'%'
      or coalesce(r.nama_vendor,'') ilike '%'||trim(p_search)||'%'
      or coalesce(r.reviewer,'') ilike '%'||trim(p_search)||'%'
      or coalesce(r.user_reject,'') ilike '%'||trim(p_search)||'%'
      or coalesce(r.alasan,'') ilike '%'||trim(p_search)||'%')
    and (nullif(trim(p_status),'') is null or r.status=trim(p_status))
  order by coalesce(r.tanggal_reject,r.created_at::date) desc,r.created_at desc;
$$;

/* ---------- VIEW ---------- */
create or replace view public.rcc_search as
select d.dokumen_id,d.nomor_pv,d.nama_vendor,d.tahun,d.nomor_box,
       d.roll_o_pack,d.rak,d.lemari,d.kode,d.box_id
from public.dokumen d;

/* ---------- PERMISSIONS ---------- */
grant select on public.dokumen to anon,authenticated;
grant select on public.boxes to anon,authenticated;
grant select on public."master data" to anon,authenticated;
grant select on public.rcc_requests to anon,authenticated;
grant select on public.rcc_rejects to anon,authenticated;

grant execute on function public.rcc_stats() to anon,authenticated;
grant execute on function public.search_rcc(text) to anon,authenticated;
grant execute on function public.rcc_box_list(text) to anon,authenticated;
grant execute on function public.rcc_box_documents(bigint) to anon,authenticated;
grant execute on function public.rcc_box_options() to anon,authenticated;
grant execute on function public.add_rcc_box(text,text,text,text,text) to anon,authenticated;
grant execute on function public.add_rcc_document(text,text,integer,text,bigint) to anon,authenticated;
grant execute on function public.import_rcc_documents(jsonb) to anon,authenticated;
grant execute on function public.check_rcc_documents(jsonb) to anon,authenticated;
grant execute on function public.rcc_pv_detail(text) to anon,authenticated;
grant execute on function public.rcc_visual_center() to anon,authenticated;
grant execute on function public.box_detail(text) to anon,authenticated;
grant execute on function public.pv_detail(text) to anon,authenticated;
grant execute on function public.rcc_request_list(text,text) to anon,authenticated;
grant execute on function public.rcc_request_create(text,text,text,text,text) to anon,authenticated;
grant execute on function public.rcc_create_reject_manual(date,text,text,text,text) to anon,authenticated;
grant execute on function public.rcc_reject_list(text,text) to anon,authenticated;

notify pgrst,'reload schema';

commit;

/* VERIFIKASI — hanya SELECT */
select * from public.rcc_stats();
