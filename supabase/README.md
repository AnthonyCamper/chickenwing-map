# Supabase

Schema and edge function source of truth for WingMap. Mirrors the layout
talias-coffee uses so that future changes can be tracked in PRs instead of
applied silently to the live project.

## Layout

```
supabase/
├── migrations/   # Sequenced .sql files; each is applied once, in order.
└── functions/    # Edge functions (Deno). Currently empty; add send-push here.
```

## Applying migrations

Local development against a Supabase shadow DB:

```bash
supabase db reset
```

Pushing to the live project (after `supabase link --project-ref <ref>`):

```bash
supabase db push
```

## Migration history

- **001_unify_to_review_level_engagement.sql** — Initial migration recorded in
  this repo. Creates `review_comments`, `review_comment_likes`,
  `review_comment_reactions`, `review_likes`, the `review_comments_detailed`
  view, and rebuilds `gallery_feed` to count engagement at the review level.
  Backfills data from the legacy per-photo tables (`photo_comments`,
  `comment_likes`, `comment_reactions`, `photo_likes`).

  The legacy table drops are commented out at the bottom of the file. Run
  them as a follow-up migration once you have verified the app no longer
  reads from those tables.

## Going forward

Future migrations should be additive numbered files (`002_…sql`,
`003_…sql`, …). Edit the live schema only via these files so the repo
remains the source of truth.
