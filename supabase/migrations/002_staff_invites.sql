-- Staff invites: connect pending invitations to real accounts.
-- Run AFTER 001_init.sql. Without this, a worker added by email never joins
-- the shop: the invite row has user_id NULL and nothing ever links it.
--
-- Flow: owner adds a worker email in Settings > Staff & Security (creates a
-- pending row). When that person signs up / logs in, claim_invites() attaches
-- the pending row to their account, and they appear in the app as Staff.

-- One pending invite per email per business (mirrors what the app checks).
create unique index if not exists business_members_pending_invite_unique
  on business_members (business_id, lower(invited_email))
  where user_id is null and invited_email is not null;

-- Attach every pending invite addressed to the signed-in user's email.
-- Called by the client right after login/signup, before loading membership.
-- Idempotent: a second call finds nothing to claim and returns 0.
create or replace function claim_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  v_email text := coalesce(auth.jwt() ->> 'email', auth.email());
begin
  if auth.uid() is null or v_email is null then
    return 0;
  end if;

  with claimed as (
    update business_members
    set user_id = auth.uid()
    where user_id is null
      and lower(invited_email) = lower(v_email)
      -- Never create a second membership in the same business
      -- (e.g. an owner who invites their own email).
      and not exists (
        select 1 from business_members m
        where m.business_id = business_members.business_id
          and m.user_id = auth.uid()
      )
    returning id
  )
  select count(*) into v_count from claimed;

  return v_count;
end;
$$;
