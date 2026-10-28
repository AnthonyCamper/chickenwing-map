-- ============================================================================
-- 043 — Comment notifications point at the comment itself
-- ============================================================================
-- notify_review_comment() (001) filled review_id but never comment_id, so a
-- tapped "X replied to your comment" notification could only open the review:
-- the app had no comment to expand, scroll to and highlight. Same function,
-- with comment_id = the new comment on every notification it creates.
-- (notifications.comment_id → review_comments ON DELETE CASCADE already
-- exists, so deleting the comment also removes its notifications.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_review_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _review_owner uuid;
  _spot_name text;
  _actor_name text;
  _preview text;
  _parent_author uuid;
  _review_id uuid;
BEGIN
  SELECT r.user_id, ws.name, r.id
  INTO _review_owner, _spot_name, _review_id
  FROM reviews r
  JOIN wing_spots ws ON ws.id = r.wing_spot_id
  WHERE r.id = new.review_id;

  IF _review_owner IS NULL THEN RETURN new; END IF;

  _actor_name := get_display_name(new.user_id);

  IF new.content_type = 'gif' THEN
    _preview := _actor_name || ' sent a GIF on your review';
  ELSIF new.content_type = 'mixed' THEN
    _preview := _actor_name || ' commented: "' || left(new.text, 80) || '" + GIF';
  ELSE
    _preview := _actor_name || ' commented: "' || left(new.text, 80) || '"';
  END IF;

  IF new.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO _parent_author FROM review_comments WHERE id = new.parent_comment_id;
    IF _parent_author IS NOT NULL AND _parent_author != new.user_id THEN
      IF NOT recent_notification_exists(_parent_author, new.user_id, 'comment_reply'::notification_type, _review_id, null, null) THEN
        INSERT INTO notifications (recipient_id, actor_id, type, review_id, comment_id, shop_name, preview_text)
        VALUES (_parent_author, new.user_id, 'comment_reply'::notification_type, _review_id, new.id, _spot_name,
          _actor_name || ' replied to your comment');
      END IF;
    END IF;
  END IF;

  IF _review_owner != new.user_id THEN
    IF NOT recent_notification_exists(_review_owner, new.user_id, 'photo_comment'::notification_type, _review_id, null, null) THEN
      INSERT INTO notifications (recipient_id, actor_id, type, review_id, comment_id, shop_name, preview_text)
      VALUES (_review_owner, new.user_id, 'photo_comment'::notification_type, _review_id, new.id, _spot_name, _preview);
    END IF;
  END IF;

  INSERT INTO notifications (recipient_id, actor_id, type, review_id, comment_id, shop_name, preview_text)
  SELECT DISTINCT
    rc.user_id,
    new.user_id,
    'comment_reply'::notification_type,
    _review_id,
    new.id,
    _spot_name,
    _actor_name || ' also commented'
  FROM review_comments rc
  WHERE rc.review_id = new.review_id
    AND rc.user_id != new.user_id
    AND rc.user_id != _review_owner
    AND (rc.user_id != _parent_author OR _parent_author IS NULL)
    AND NOT recent_notification_exists(rc.user_id, new.user_id, 'comment_reply'::notification_type, _review_id, null, null);

  RETURN new;
END;
$function$;
