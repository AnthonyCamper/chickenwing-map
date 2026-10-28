-- ============================================================================
-- 041 — Slugs keep accented letters as their plain form
-- ============================================================================
-- slugify() dropped every non a–z character, so "Carlos Ramírez" became
-- @carlos-ram-rez and "Peña" → "pe-a". Transliterate common Latin accents
-- first (translate() is immutable and needs no extension). Only affects new
-- usernames / spot and list slugs; existing ones are left alone so links
-- keep working.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' FROM regexp_replace(
    regexp_replace(
      translate(
        replace(replace(replace(lower(coalesce(input, '')), 'ß', 'ss'), 'æ', 'ae'), 'œ', 'oe'),
        'áàâäãåāăąçćčďéèêëēėęěíìîïīįłñńňóòôöõøōőŕřśšşťúùûüūůűųýÿźżž',
        'aaaaaaaaacccdeeeeeeeeiiiiiilnnnoooooooorrssstuuuuuuuuyyzzz'
      ),
      '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$$;
