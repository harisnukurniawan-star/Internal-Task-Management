-- Keep evidence uploads within free-tier-friendly limits and make employee claim versions immutable.
update storage.buckets
set file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']::text[]
where id = 'task-evidence';

drop policy if exists claims_update on public.task_claims;
create policy claims_update
on public.task_claims
for update
to authenticated
using (private.is_supervisor())
with check (private.is_supervisor());
