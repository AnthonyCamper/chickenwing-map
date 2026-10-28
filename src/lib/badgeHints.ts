import type { Badge, BadgeWithEarned } from './types'

/**
 * Oblique, per-badge hints shown for LOCKED badges only. Written in the same
 * wry, teasing voice as the earned-badge descriptions — commentary, not
 * instructions — and keyed by slug (not criteria_type) so every badge gets
 * copy written for what it actually is, not a shared template.
 */
const BADGE_TEASERS: Record<string, string> = {
  'first-review': "Everybody's got a first time. Yours hasn't happened yet.",
  'review-count-5': "Five in, and you're still very much in the honeymoon phase.",
  'review-count-10': "Past the beginner arc. Not yet a main character.",
  'review-count-25': 'Enough reviews that people should probably start asking your opinion.',
  'review-count-50': 'At some point this stops being a hobby and starts being a lifestyle.',
  'size-sampler': 'Small, medium, large, jumbo — commitment issues, but for wing sizes.',
  'wing-veteran': "You've put in enough reps to have Opinions, capital O.",
  'century-club': 'Triple digits. Somebody should probably check on you.',

  '2026-chicken-wing-crawl-ottawa-rsvp': "Say the word. The route's waiting on you.",
  '2026-dc-chicken-wing-crawl-rsvp': 'Two words. You already know which ones.',
  '2026-dc-chicken-wing-crawl-early': 'Beat literally everyone else there. Set an alarm.',
  '2026-chicken-wing-crawl-ottawa-early': 'Somebody has to be first through the door. Might as well be you.',
  '2026-dc-chicken-wing-crawl-social': 'A solo RSVP is fine. This one wants a crowd.',
  '2026-chicken-wing-crawl-ottawa-social': 'One person does not fill a canoe. Bring friends.',
  '2026-chicken-wing-crawl-ottawa-first': 'The route has a first stop. Go stand in it.',
  '2026-dc-chicken-wing-crawl-first': "Somewhere on the route, a first stop is waiting to be checked into.",
  '2026-chicken-wing-crawl-ottawa-two': 'Two stops. Like the coffee order, but wings.',
  '2026-dc-chicken-wing-crawl-two': "Barely broken a sweat — a couple of stops in.",
  '2026-dc-chicken-wing-crawl-three': "Momentum's a real thing on this route. You'll feel it a few stops deep.",
  '2026-chicken-wing-crawl-ottawa-three': 'Hockey people already know exactly what number this is about.',
  '2026-chicken-wing-crawl-ottawa-four': 'The route gets long in the middle. Keep carrying on.',
  '2026-dc-chicken-wing-crawl-four': 'Deep enough in that people start asking you for recommendations.',
  '2026-chicken-wing-crawl-ottawa-review': "Somebody's got to go on the record. Might as well be you.",
  '2026-dc-chicken-wing-crawl-review': 'The route deserves at least one hot take from you, in writing.',
  '2026-dc-chicken-wing-crawl-all-reviews': "Checking in isn't the whole job. Finish what you started.",
  '2026-chicken-wing-crawl-ottawa-all-reviews': 'Keep the official record complete. Every stop gets its say.',
  '2026-chicken-wing-crawl-ottawa-champion': 'Every single stop. No skipping, no shortcuts.',
  '2026-dc-chicken-wing-crawl-champion': 'The whole route, start to finish. No half measures.',

  scout: 'Your usual spot is fine. It is also not the only spot.',
  explorer: "The map is bigger than the corner of it you've been sticking to.",
  cartographer: "At some point you'll know this map better than whoever drew it.",
  'district-mapper': "You're not exploring anymore. You're annexing.",

  'flavor-curious': "The menu has more than one line on it. Start reading further down.",
  'sauce-scholar': "You've clearly stopped ordering the same thing out of habit.",
  'flavor-professor': "At this point you could grade other people's flavor choices.",

  'lemon-pepper-legend': "This one's earned at the counter, not in the write-up.",
  'crispy-devotee': "This one's earned in the write-up, not at the counter.",
  'ranch-defender': 'No defense needed in writing. Just order the thing.',
  'bone-in-purist': "Ordering it isn't enough — you have to actually say something about it.",
  'blue-cheese-believer': 'Believing quietly does not count. Put it in writing.',
  'heat-survivor': 'Somewhere on the menu is a flavor with warning-label energy. Order that one.',
  'the-essayist': 'Some people leave a rating. You leave a thesis.',
  'short-and-sweet': 'Say it and get out. Nobody needs the director\'s cut.',
  'scorched-earth': 'Give a spot a rating that ends the conversation entirely.',

  'first-crawl': "Everybody's got a first list in them. Time to let yours out.",
  'first-voice': "The comment section is right there. Use your words.",
  'not-impressed': 'Give a spot a rating that says plenty without saying much.',
  'loud-mouth': "You clearly have thoughts. Keep sharing them.",
  'thread-lord': 'At some point the comment section just becomes your section.',
  'easy-grader': "Somebody's out here handing out great scores like candy. Could be you.",
  'crawl-curator': 'A crawl with two stops on it is a suggestion. Make it a real list.',
  'rookie-rater': 'Whole numbers only. No decimals, not even once.',
  'crawl-crowd-pleaser': 'Make a crawl good enough that people actually hit like.',
  'decimal-daredevil': 'Whole numbers are for cowards. Live a little.',
  'crawl-prolific': 'One list is a hobby. A stack of them is a whole personality.',
  'crawl-spoke-up': 'Somebody made a crawl. You have opinions about it. Say so.',
  'crawl-yapper': 'You clearly did not stop at just one comment.',
  'crawl-hot-take': "Tell a crawl exactly how mid you think it is. Don't hold back.",
  'harsh-critic': 'Keep your average score somewhere near rock bottom for a while.',
  'high-standards': 'Keep your average score somewhere near flawless for a while.',
  'crawl-hype-beast': 'Hype a crawl up like it just dropped a new album.',
  'crawl-just-a-gif': 'Words are optional. A GIF says plenty.',
  'perfect-ten': 'Somewhere out there is a spot worth the absolute max score. Find it.',
  'crawl-reply-guy': "Somebody else's crawl. Your comment. You know how this works.",
  'rate-tough-crowd': 'Give a spot a low score and let them sit with it.',
  'rate-cold-blooded': "Give a spot the actual worst score possible. Don't blink.",
  'rate-serial-hater': 'Rack up a run of reviews that are all pretty unkind.',
  'rate-easy-lover': 'Rack up a run of reviews that all read like fan mail.',
  'takeout-king': 'Skip the dine-in enough times and it starts to count for something.',
  'to-go-loyalist': 'At this point, eating in is basically a foreign concept to you.',
  regular: 'Go back to the same spot enough times and they start to know your order.',
  'day-one': 'Loyalty like this deserves a title, not just a punch card.',
  'jumbo-fan': "This one's decided at the counter, not in your write-up.",

  'canadiana-confederation': 'Every Canadian kid learns this year before they learn their own postal code.',
  'canadiana-canada-day': "It's Canada's birthday. Everybody already knows which day that falls on — do with that what you will.",
  'canadiana-skateway': "The world's longest skating rink has a length. This badge has the same idea.",
  'canadiana-great-one': 'One jersey number. Every hockey fan in the country already has it memorized.',
  'canadiana-loonie': "If that's true, I hope you only paid a loonie for it.",
  'canadiana-toonie': "If that's true, I hope it only cost you a toonie.",
  'canadiana-poutine': "You don't have to order it. Just bring it up.",
  'canadiana-extra-u': 'Spell something the way we do up here, not the way they do down south.',
  'canadiana-sorry': 'Apologizing for nothing in particular is basically a national pastime.',
  'canadiana-tapped': 'Every spring, something very Canadian starts running through the trees.',
  'canadiana-rink-rat': 'This city loses its mind over one sport (and one team) every winter.',
  'canadiana-timmies': "You don't have to actually go. Just bring it up.",
  'canadiana-honey-garlic': "You don't have to write a treaty about it. Just order it.",
}

/** The playful teaser. Badges without one fall back to the plain
 *  instruction (the old "you'll have to find it" contradicted it). */
export function badgeTeaser(badge: Badge | BadgeWithEarned): string {
  return BADGE_TEASERS[badge.slug] ?? howToEarn(badge)
}

// Hints stored with event badges say "crawl review" / "crawl stop"; "crawl"
// (a walk between restaurants) is the jargon non-native readers trip on.
function plainHint(hint: string): string {
  return hint
    .replace(/\bon a crawl review\b/gi, 'on a review during the event')
    .replace(/\bin a crawl review\b/gi, 'in a review during the event')
    .replace(/\bduring the crawl\b/gi, 'during the event')
    .replace(/\bat a crawl stop\b/gi, 'at a stop on the event route')
    // Local nickname non-native readers can't decode (m2 nonnative 3).
    .replace(/\bthe Sens\b/g, 'the Ottawa Senators, "the Sens"')
}

/** One literal sentence saying how to earn a badge. Badge names and teasers
 *  can be jokes or cultural references; this line never is (m1 nonnative 3). */
export function howToEarn(b: Badge | BadgeWithEarned): string {
  const cfg = b.criteria_config ?? {}
  // Some criteria types exist in the database but not (yet) in the
  // BadgeCriteriaType union, so switch on the plain string.
  switch (b.criteria_type as string) {
    case 'first_review':        return 'Post your first review.'
    case 'review_count':        return `Post ${cfg.count ?? '?'} reviews.`
    case 'wing_size_variety':   return 'Review wings of every size: small, medium, large, and jumbo.'
    case 'event_rsvp':              return 'RSVP "I\'m in" to the event.'
    case 'event_rsvp_with_guests':  return 'RSVP "I\'m in" to the event and bring guests.'
    case 'event_checkin_count':     return cfg.count === 1 ? 'Check in to any stop on the event route.' : `Check in to ${cfg.count} stops on the event route.`
    case 'event_complete':          return 'Check in to every stop on the event route.'
    case 'event_first_checkin':     return 'Be the first person to check in at any stop on the event route.'
    case 'event_review_count':      return 'Leave at least one review during the event.'
    case 'event_review_all':        return 'Leave a review at every stop you check into.'
    case 'unique_spots':            return `Review wings at ${cfg.count ?? '?'} different spots.`
    case 'flavor_variety':      return `Try ${cfg.count ?? '?'} different wing flavors.`
    case 'lemon_pepper':        return 'Review a spot specifically for lemon pepper wings.'
    case 'ranch_fan':           return 'Review wings with ranch in the flavor.'
    case 'heat_seeker':         return 'Review ghost pepper, reaper, habanero, scorpion, or carolina wings.'
    case 'comment_count':       return `Leave ${cfg.count ?? '?'} comment${cfg.count === 1 ? '' : 's'} on reviews.`
    case 'avg_rating_high':     return `Maintain an average rating of ${cfg.min_avg ?? 9}+ across ${cfg.min_reviews ?? 5}+ reviews.`
    case 'avg_rating_low':      return `Maintain an average rating of ${cfg.max_avg ?? 4} or lower across ${cfg.min_reviews ?? 5}+ reviews.`
    case 'perfect_ten':         return 'Give a perfect 10/10 rating to a wing spot.'
    case 'takeout_count':       return `Review ${cfg.count ?? '?'} takeout orders.`
    case 'loyal_regular':       return `Review the same spot ${cfg.count ?? 3}+ times.`
    case 'jumbo_fan':             return 'Review a spot for jumbo wings.'
    case 'review_text_contains':  return cfg.hint ? plainHint(cfg.hint)
      : (cfg.word ? `Mention "${cfg.word}" in a review.`
        : b.slug === 'bone-in-purist' ? 'Mention "bone-in" wings in a review.'
        : 'Use a specific word in a review.')
    case 'review_text_long':      return `Write a review with at least ${cfg.min_length ?? 300} characters.`
    case 'review_text_short':     return `Write a review with ${cfg.max_length ?? 15} characters or fewer.`
    case 'single_rating_low':     return `Give a rating of ${cfg.max_rating ?? 2}.0 or below on any review.`
    case 'rating_floor':          return `Never give below a ${cfg.min_rating ?? 8}.0, with at least ${cfg.min_reviews ?? 5} reviews.`
    case 'rating_no_decimals':    return `Give at least ${cfg.min_reviews ?? 3} reviews and never use a decimal — whole numbers only.`
    case 'rating_uses_decimals':  return 'Use a decimal rating at least once (e.g. 7.5, 8.3).'
    case 'rating_exact':          return cfg.hint ? plainHint(cfg.hint) : `Give a rating of exactly ${cfg.value ?? '?'}.`
    case 'flavor_contains':       return cfg.hint ? plainHint(cfg.hint) : `Review wings with ${cfg.text ?? 'a specific'} flavor.`
    case 'rating_at_or_below':    return (cfg.count ?? 1) <= 1
      ? `Give a rating of ${cfg.max_rating ?? '?'} or lower on any review.`
      : `Give a rating of ${cfg.max_rating ?? '?'} or lower on ${cfg.count} reviews.`
    case 'rating_at_or_above':    return (cfg.count ?? 1) <= 1
      ? `Give a rating of ${cfg.min_rating ?? '?'} or higher on any review.`
      : `Give a rating of ${cfg.min_rating ?? '?'} or higher on ${cfg.count} reviews.`
    // "Crawl" badges are about lists of wing spots.
    case 'first_crawl':           return 'Make your first list of wing spots.'
    case 'crawl_count':           return `Make ${cfg.count ?? '?'} lists of wing spots.`
    case 'crawl_with_n_spots':    return `Make a list with ${cfg.min_items ?? '?'} or more wing spots.`
    case 'crawl_with_n_likes':    return `Get ${cfg.min_likes ?? '?'} likes on one of your lists.`
    case 'crawl_comment_count':   return (cfg.count ?? 1) <= 1
      ? 'Leave a comment on a list.'
      : `Leave ${cfg.count} comments on lists.`
    case 'crawl_comment_on_others': return "Leave a comment on someone else's list."
    case 'crawl_comment_gif':     return 'Reply to a list with a GIF.'
    case 'crawl_comment_contains': return cfg.hint
      ?? (b.slug === 'crawl-hot-take' ? 'Leave a comment on a list that calls it "overrated", "mid" or "trash".'
        : b.slug === 'crawl-hype-beast' ? 'Leave a comment on a list that praises it, with a word like "fire", "elite" or "goat".'
        : 'Use a specific word in a comment on a list.')
    default:                      return b.description ?? ''
  }
}

