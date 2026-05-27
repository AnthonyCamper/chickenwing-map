-- Phase 0 of the Letterboxd-style growth plan: when site_settings.is_public = true,
-- new signups should land in 'approved' status so RLS (can_review()) lets them post
-- immediately. When the site is private, fall back to the original 'pending' default
-- so the admin approval queue still works.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_public boolean;
BEGIN
  SELECT is_public INTO v_is_public FROM public.site_settings LIMIT 1;
  INSERT INTO public.profiles (id, email, full_name, avatar_url, display_name, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN COALESCE(v_is_public, false) THEN 'approved' ELSE 'pending' END
  );
  RETURN NEW;
END;
$$;
