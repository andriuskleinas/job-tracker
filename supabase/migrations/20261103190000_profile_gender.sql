-- Optional gender identity and pronouns on the account page. Everything is
-- null by default and only the owner can read it (profiles RLS). Identities
-- and pronouns are id lists from src/lib/gender.ts, so a person can pick more
-- than one; the *_description columns hold their own words when no listed
-- option fits. The app ignores ids it doesn't know, so the checks only guard
-- against junk, not against ids the app hasn't shipped.
ALTER TABLE public.profiles
  ADD COLUMN gender_identities text[]
    CONSTRAINT profiles_gender_identities_format
      CHECK (
        cardinality(gender_identities) <= 80
        AND array_to_string(gender_identities, ',') ~ '^([a-z-]{1,32}(,[a-z-]{1,32})*)?$'
      ),
  ADD COLUMN gender_description text
    CONSTRAINT profiles_gender_description_length CHECK (char_length(gender_description) <= 80),
  ADD COLUMN pronouns text[]
    CONSTRAINT profiles_pronouns_format
      CHECK (
        cardinality(pronouns) <= 20
        AND array_to_string(pronouns, ',') ~ '^([a-z-]{1,32}(,[a-z-]{1,32})*)?$'
      ),
  ADD COLUMN pronouns_description text
    CONSTRAINT profiles_pronouns_description_length CHECK (char_length(pronouns_description) <= 40);
