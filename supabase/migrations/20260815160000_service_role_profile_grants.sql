-- The letter notifier is the first thing in this app to touch a table as
-- service_role, which exposed that the role has no privileges on
-- public.profiles in this database -- reads fail with "permission denied for
-- table profiles". Nothing in migrations revoked them; the grant was simply
-- never there.
--
-- Scoped to the two columns the notifier actually uses rather than the blanket
-- grant service_role usually carries, matching how anon is scoped in
-- 20260504152000. id is included because filtering on a column requires select
-- privilege on it.

grant select (id, letter_email_notifications) on public.profiles to service_role;

-- the unsubscribe endpoint turns the preference off for a user who has no
-- session, so it writes as service_role.
grant update (letter_email_notifications) on public.profiles to service_role;
