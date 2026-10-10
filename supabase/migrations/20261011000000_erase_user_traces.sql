-- Optional: lets the "Delete account" feature also erase the sign-in event log entries (which record the user's email address and
-- may record network details) that the authentication system keeps in auth.audit_log_entries. The app calls this function best effort,
-- so account deletion still works if it has not been applied; apply it to make deletion complete.
create or replace function public.security_erase_user_traces(p_user uuid, p_email text)
returns void language sql security definer set search_path = '' as $$
  delete from auth.audit_log_entries
  where payload->>'actor_id' = p_user::text
     or payload->'traits'->>'user_id' = p_user::text
     or (p_email is not null and lower(payload->>'actor_username') = lower(p_email));
$$;
revoke all on function public.security_erase_user_traces(uuid, text) from public, anon, authenticated;
grant execute on function public.security_erase_user_traces(uuid, text) to service_role;
