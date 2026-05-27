// ─── Auth types ───────────────────────────────────────────────────────────────

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'disabled'

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'pending'
  | 'rejected'
  | 'disabled'
  | 'authorized'

// ─── Database row types ────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  display_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  status: UserStatus
  is_admin: boolean
  can_leave_reviews: boolean
  is_private: boolean
  created_at: string
}

/** @deprecated Use UserProfile instead */
export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface ApprovedUser {
  email: string
  is_admin: boolean
  added_at: string
}

export interface SiteSettings {
  is_public: boolean
}

export interface WingSpot {
  id: string
  name: string
  slug: string | null
  address: string
  lat: number
  lng: number
  created_at: string
}

export interface ReviewPhoto {
  id: string
  review_id: string
  storage_path: string
  url: string
  display_order: number
  created_at: string
}

export interface Review {
  id: string
  wing_spot_id: string
  user_id: string
  overall_rating: number  // 1–10
  wing_size: string | null  // 'small' | 'medium' | 'large' | 'jumbo'
  wing_flavor: string | null
  is_takeout: boolean
  takeout_container: string | null  // 'styrofoam' | 'cardboard' | 'plastic' | 'aluminum' | 'bag_only' | 'other'
  review_text: string | null
  legacy_data: any | null
  event_id: string | null
  event_stop_id: string | null
  event_slug: string | null
  event_name: string | null
  visited_at: string
  created_at: string
  updated_at: string
  // Joined from profiles
  reviewer_name: string | null
  reviewer_username: string | null
  reviewer_avatar: string | null
  reviewer_email: string | null
  reviewer_is_private: boolean | null
  // Joined from wing_spots (when fetched via reviews_with_profiles)
  spot_slug?: string | null
  // Attached photos
  photos?: ReviewPhoto[]
}

// ─── Composite view type used in the UI ───────────────────────────────────────

export interface SpotWithReviews {
  spot: WingSpot
  reviews: Review[]
  avg_rating: number
  photos: ReviewPhoto[]   // all photos across all reviews for this spot, newest first
}

// ─── Gallery / Social types ────────────────────────────────────────────────────

export interface GalleryPhoto {
  photo_id: string
  photo_url: string
  display_order: number
  photo_created_at: string
  review_id: string
  overall_rating: number
  wing_flavor: string | null
  review_text: string | null
  visited_at: string
  wing_spot_id: string
  spot_name: string
  spot_slug: string | null
  spot_address: string
  reviewer_id: string
  reviewer_name: string | null
  reviewer_username: string | null
  reviewer_avatar: string | null
  reviewer_email: string | null
  reviewer_is_private: boolean | null
  like_count: number
  comment_count: number
  is_liked_by_me: boolean
  event_id: string | null
  event_slug: string | null
  event_name: string | null
}

/** A review-level gallery item grouping all photos belonging to one review. */
export interface GalleryReviewItem {
  review_id: string
  overall_rating: number
  wing_flavor: string | null
  review_text: string | null
  visited_at: string
  wing_spot_id: string
  spot_name: string
  spot_slug: string | null
  spot_address: string
  reviewer_id: string
  reviewer_name: string | null
  reviewer_username: string | null
  reviewer_avatar: string | null
  reviewer_email: string | null
  reviewer_is_private: boolean | null
  like_count: number
  comment_count: number
  is_liked_by_me: boolean
  event_id: string | null
  event_slug: string | null
  event_name: string | null
  /** All photos attached to this review, ordered by display_order. */
  photos: Array<{
    photo_id: string
    photo_url: string
    display_order: number
    photo_created_at: string
  }>
}

export interface CommentReaction {
  reaction_type: string
  count: number
  is_mine: boolean
}

export type CommentContentType = 'text' | 'gif' | 'mixed'

/** Shared comment fields used by CommentSection (display-only, no target ref). */
export interface Comment {
  id: string
  user_id: string
  text: string | null
  created_at: string
  parent_comment_id: string | null
  content_type: CommentContentType
  media_url: string | null
  commenter_name: string | null
  commenter_avatar: string | null
  commenter_email: string | null
  like_count: number
  is_liked_by_me: boolean
  reply_count: number
  reactions: CommentReaction[]
  replies?: Comment[]
}

export interface ReviewComment extends Comment {
  review_id: string
  replies?: ReviewComment[]
}

export interface AddCommentOptions {
  text?: string
  parentCommentId?: string | null
  mediaUrl?: string | null
  contentType?: CommentContentType
}

// ─── Notification types ──────────────────────────────────────────────────────

export type NotificationType =
  | 'new_review'
  | 'photo_comment'
  | 'comment_reply'
  | 'photo_like'
  | 'comment_like'
  | 'comment_reaction'
  | 'crawl_like'
  | 'new_crawl_from_followed_user'

export interface Notification {
  id: string
  recipient_id: string
  actor_id: string | null
  type: NotificationType
  review_id: string | null
  photo_id: string | null
  comment_id: string | null
  crawl_id: string | null
  shop_name: string | null
  preview_text: string | null
  read: boolean
  push_sent: boolean
  created_at: string
  // Joined actor info (from query)
  actor_name?: string | null
  actor_avatar?: string | null
}

export interface NotificationPreferences {
  user_id: string
  enabled: boolean
  new_review: boolean
  photo_comment: boolean
  comment_reply: boolean
  photo_like: boolean
  comment_like: boolean
  comment_react: boolean
  crawl_like: boolean
  new_crawl_from_followed_user: boolean
  quiet_mode: boolean
}

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_key: string
  user_agent: string | null
  created_at: string
}

// ─── Form types ───────────────────────────────────────────────────────────────

export interface ReviewFormData {
  shop_name: string
  address: string
  lat: string
  lng: string
  overall_rating: number
  wing_size?: string
  wing_flavor?: string
  is_takeout: boolean
  takeout_container?: string
  review_text?: string
  visited_at: string
  photos?: File[]
  event_id?: string | null
  event_stop_id?: string | null
}

export interface ReviewUpdateData {
  overall_rating?: number
  wing_size?: string
  wing_flavor?: string
  is_takeout?: boolean
  takeout_container?: string
  review_text?: string
  visited_at?: string
  photos_to_delete?: string[]   // review_photos IDs to remove from DB + storage
  new_photos?: File[]           // new photos to upload and attach
}

// ─── Events / Badges ──────────────────────────────────────────────────────────

export type RsvpStatus = 'going' | 'maybe' | 'not_going'

export interface WingEvent {
  id: string
  slug: string
  name: string
  description: string | null
  cover_image_url: string | null
  starts_at: string | null
  ends_at: string | null
  is_published: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  // From events_with_counts
  stop_count?: number
  going_count?: number
  maybe_count?: number
}

export interface EventStop {
  id: string
  event_id: string
  wing_spot_id: string
  position: number
  planned_arrival: string | null
  notes: string | null
  parking_notes: string | null
  created_at: string
  // Joined from wing_spots
  spot_name?: string
  spot_address?: string
  spot_lat?: number
  spot_lng?: number
  checkin_count?: number
}

export interface EventRsvp {
  id: string
  event_id: string
  user_id: string
  status: RsvpStatus
  guest_count: number
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  user_name?: string | null
  user_avatar?: string | null
  user_email?: string | null
  is_private?: boolean
}

export interface EventCheckin {
  id: string
  event_id: string
  event_stop_id: string
  user_id: string
  review_id: string | null
  checked_in_at: string
}

export type BadgeCriteriaType =
  | 'first_review'
  | 'review_count'
  | 'wing_size_variety'
  | 'event_rsvp'
  | 'event_rsvp_with_guests'
  | 'event_checkin_count'
  | 'event_complete'
  | 'event_first_checkin'
  | 'event_review_count'
  | 'event_review_all'
  | 'unique_spots'
  | 'flavor_variety'
  | 'lemon_pepper'
  | 'ranch_fan'
  | 'heat_seeker'
  | 'comment_count'
  | 'avg_rating_high'
  | 'avg_rating_low'
  | 'perfect_ten'
  | 'takeout_count'
  | 'loyal_regular'
  | 'jumbo_fan'
  | 'review_text_contains'
  | 'review_text_long'
  | 'review_text_short'
  | 'single_rating_low'
  | 'rating_floor'
  | 'rating_no_decimals'
  | 'rating_uses_decimals'

export interface LeaderboardRow {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  review_count: number
  unique_spots: number
  avg_rating: number | null
  comment_count: number
  badge_count: number
  total_likes_received: number
}

export interface Badge {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string
  color: string
  criteria_type: BadgeCriteriaType
  criteria_config: Record<string, any>
  event_id: string | null
  sort_order: number
}

export interface BadgeWithEarned extends Badge {
  earned: boolean
  earned_at: string | null
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  event_id: string | null
  earned_at: string
}

// ─── Crawls (Lists) ──────────────────────────────────────────────────────────

export interface WingCrawl {
  id: string
  user_id: string
  slug: string
  title: string
  description: string | null
  cover_image_url: string | null
  is_public: boolean
  is_ranked: boolean
  created_at: string
  updated_at: string
}

export interface WingCrawlItem {
  id: string
  crawl_id: string
  wing_spot_id: string
  position: number
  note: string | null
  added_at: string
}

/** wing_crawls_detailed view — adds masked author fields, item_count, like_count. */
export interface WingCrawlDetailed extends WingCrawl {
  author_name: string | null
  author_avatar: string | null
  author_username: string | null
  author_is_private: boolean
  item_count: number
  like_count: number
  is_liked_by_me: boolean
}

export interface CrawlFormData {
  title: string
  description?: string
  is_public?: boolean
  is_ranked?: boolean
  cover_image_url?: string | null
}

export interface EventWithDetails {
  event: WingEvent
  stops: EventStop[]
  myRsvp: EventRsvp | null
  myCheckins: EventCheckin[]
}

export interface EventFormData {
  slug: string
  name: string
  description?: string
  cover_image_url?: string
  starts_at?: string | null
  ends_at?: string | null
  is_published: boolean
}
