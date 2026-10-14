-- 004: raise the staff seat limit from 5 to 20 per shop.
-- Run once, in the Supabase SQL editor (SQL Editor > New query > Run).
--
-- The free tier keeps max_staff = 0 (owner only). Launch mode is on, so
-- every shop currently receives the Pro limits this changes.

update plans
   set limits = jsonb_set(limits, '{max_staff}', '20'::jsonb)
 where tier = 'pro';

-- Verify: max_staff should read 20 for pro and 0 for free.
select tier, limits ->> 'max_staff' as max_staff
from plans
order by tier;

-- Shops that hit the old 5-seat cap keep their deactivated staff on record.
-- To bring a shop's oldest seats back up to the new limit:
--   select apply_plan_limits('<business-id>');
-- Careful: this reactivates every staff slot under the limit, including
-- anyone an owner switched off by hand. Otherwise just re-enable them in
-- Settings > Staff & Security.
