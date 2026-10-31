-- Terms 2026-10-30 make talent-pool listing a condition of a candidate account. Every candidate profile is inserted
-- listed: when a writer leaves the flag off (direct accounts, a first profile save), this trigger lists the profile and
-- records the grant. An upsert on an existing profile also fires BEFORE INSERT, so the grant is only written for a
-- profile that does not exist yet. 2026-10-30 is TALENT_POOL_CONSENT_VERSION.
CREATE OR REPLACE FUNCTION lokus_list_candidate_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.talent_pool_listed AND NOT EXISTS (SELECT 1 FROM candidate_profiles WHERE user_id = NEW.user_id) THEN
    NEW.talent_pool_listed := true;
    INSERT INTO consent_events (user_id, kind, action, text_version) VALUES (NEW.user_id, 'talent_pool', 'grant', '2026-10-30');
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER candidate_profiles_listed BEFORE INSERT ON candidate_profiles FOR EACH ROW EXECUTE FUNCTION lokus_list_candidate_profile();
--> statement-breakpoint

-- Accounts created before those terms: list every active candidate, recording the grant as its own consent event.
INSERT INTO consent_events (user_id, kind, action, text_version)
SELECT p.user_id, 'talent_pool', 'grant', '2026-10-30'
FROM candidate_profiles p JOIN users u ON u.id = p.user_id
WHERE NOT p.talent_pool_listed AND u.disabled_at IS NULL;
--> statement-breakpoint
UPDATE candidate_profiles p SET talent_pool_listed = true, updated_at = now()
FROM users u
WHERE u.id = p.user_id AND NOT p.talent_pool_listed AND u.disabled_at IS NULL;
--> statement-breakpoint
-- Active candidates without a profile row get one; the trigger above lists it.
INSERT INTO candidate_profiles (user_id)
SELECT u.id FROM users u
WHERE u.kind = 'candidate' AND u.disabled_at IS NULL AND NOT EXISTS (SELECT 1 FROM candidate_profiles p WHERE p.user_id = u.id);
