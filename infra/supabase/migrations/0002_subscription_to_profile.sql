-- Solo Compass — keep profiles.entitlement_tier in sync with the
-- subscription_events outbox written by the iOS SubscriptionService.
--
-- Background: 0001_init.sql created both tables but never linked them.
-- The iOS client only writes to subscription_events; the Edge Functions
-- read profiles.entitlement_tier. Without this trigger profiles stays at
-- 'free' forever and every Pro user is rejected with 402 by chat-proxy
-- / synthesize-experiences.
--
-- Mapping (StoreKit lifecycle → entitlement_tier):
--   subscribed       → pro       (or pro_trial if is_in_trial_period)
--   upgraded         → pro       (paid upgrade after trial / plan change)
--   in_grace_period  → pro       (Apple still considers the user paid)
--   expired          → pro_expired
--   revoked          → free      (refund / family-sharing removal)
--
-- The trigger is AFTER INSERT only — subscription_events is an append-only
-- outbox (the iOS service enqueues a row per state change), so updates are
-- not part of the contract. Idempotent: re-inserting the same logical event
-- produces the same target tier.
--
-- Rollback is at the bottom of this file (commented).

begin;

create or replace function public.sc_apply_subscription_event()
returns trigger
language plpgsql
security definer  -- bypass RLS on profiles update; the trigger only
                  -- writes the row whose user_id matches NEW.user_id.
set search_path = public
as $$
declare
  new_tier text;
begin
  case new.event_type
    when 'subscribed' then
      new_tier := case when new.is_in_trial_period then 'pro_trial' else 'pro' end;
    when 'upgraded' then
      new_tier := 'pro';
    when 'in_grace_period' then
      new_tier := 'pro';
    when 'expired' then
      new_tier := 'pro_expired';
    when 'revoked' then
      new_tier := 'free';
    else
      return new;  -- unknown event_type: leave profile untouched
  end case;

  -- Upsert: profile row may not exist yet for fresh anonymous users
  -- whose first observable action is a purchase. RLS is bypassed via
  -- security definer; ownership is still constrained by new.user_id.
  insert into public.profiles (user_id, entitlement_tier)
    values (new.user_id, new_tier)
    on conflict (user_id) do update
      set entitlement_tier = excluded.entitlement_tier,
          updated_at       = now();

  return new;
end;
$$;

drop trigger if exists sc_subscription_event_to_profile on public.subscription_events;
create trigger sc_subscription_event_to_profile
  after insert on public.subscription_events
  for each row execute function public.sc_apply_subscription_event();

commit;

-- ─── Rollback (run manually if needed) ──────────────────────────────────
-- begin;
-- drop trigger if exists sc_subscription_event_to_profile on public.subscription_events;
-- drop function if exists public.sc_apply_subscription_event();
-- commit;
