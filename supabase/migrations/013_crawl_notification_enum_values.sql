-- ALTER TYPE ADD VALUE must be committed before the new value can be used.
-- Migration 014 adds the columns, triggers, and prefs that use these.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'crawl_like';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'new_crawl_from_followed_user';
