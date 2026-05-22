import { useLeaderboard, type LeaderboardCategory } from '../hooks/useLeaderboard'
import { useUserProfile } from './UserProfileContext'
import type { LeaderboardRow } from '../lib/types'

interface Props {
  currentUserId: string
  onClose: () => void
}

const CATEGORIES: { key: LeaderboardCategory; label: string; emoji: string; stat: (r: LeaderboardRow) => string }[] = [
  { key: 'reviews',  label: 'Ratings',  emoji: '🍗', stat: r => `${r.review_count} reviews` },
  { key: 'spots',    label: 'Spots',    emoji: '📍', stat: r => `${r.unique_spots} spots` },
  { key: 'heat',     label: 'Heat',     emoji: '🔥', stat: r => r.avg_rating != null ? `${r.avg_rating} avg` : '—' },
  { key: 'comments', label: 'Mouth',    emoji: '💬', stat: r => `${r.comment_count} comments` },
  { key: 'badges',   label: 'Badges',   emoji: '🏅', stat: r => `${r.badge_count} badges` },
  { key: 'likes',    label: 'Likes',    emoji: '❤️', stat: r => `${r.total_likes_received} likes` },
]

export default function LeaderboardModal({ currentUserId, onClose }: Props) {
  const { rows, loading, category, setCategory, myRank } = useLeaderboard(currentUserId)
  const { openProfile } = useUserProfile()

  const catDef = CATEGORIES.find(c => c.key === category)!

  return (
    <>
      <div className="fixed inset-0 z-50 bg-night-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center p-0 sm:p-6">
        <div className="w-full sm:max-w-md bg-cream-50 sm:rounded-2xl sm:border-2 sm:border-night-900 sm:shadow-sticker overflow-hidden flex flex-col animate-slide-up"
             style={{ maxHeight: '90dvh' }}>

          {/* Header */}
          <div className="bg-night-900 px-5 pt-safe-4 pb-4 flex-shrink-0 grain-overlay relative">
            <div className="pointer-events-none absolute inset-0 bg-halftone-dark opacity-20" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-sauce-300 mb-1">Community</p>
                <h2 className="font-display uppercase tracking-wide text-3xl text-cream-50 leading-tight">
                  The board
                </h2>
                {myRank && (
                  <p className="text-[11px] font-bold uppercase tracking-crowd text-cream-100/70 mt-1">
                    Your rank: <span className="text-sauce-300">#{myRank}</span>
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="mt-1 w-8 h-8 rounded-lg bg-night-700 text-cream-50 flex items-center justify-center text-lg hover:bg-sauce-500 transition-colors border border-night-500 flex-shrink-0"
                aria-label="Close"
              >×</button>
            </div>

            {/* Category tabs */}
            <div className="relative flex gap-1.5 mt-4 overflow-x-auto scrollbar-hide pb-0.5">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-crowd transition-all
                    ${category === c.key
                      ? 'bg-sauce-400 text-cream-50 border-2 border-cream-50/30'
                      : 'bg-night-700 text-cream-200/70 hover:text-cream-50 border-2 border-transparent'}`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
                <p className="eyebrow">Loading the board…</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-display uppercase tracking-wide text-xl text-night-900">Nobody on the board yet</p>
                <p className="text-sm text-charcoal-500 mt-2">Be the first to post a review.</p>
              </div>
            ) : (
              <ul>
                {rows.map((row, idx) => {
                  const rank = idx + 1
                  const isMe = row.user_id === currentUserId
                  const isPodium = rank <= 3
                  return (
                    <li
                      key={row.user_id}
                      onClick={() => openProfile(row.user_id)}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-night-900/10 cursor-pointer hover:bg-cream-100/80 transition-colors
                        ${isMe ? 'bg-sauce-50 border-l-4 border-l-sauce-400' : ''}
                        ${isPodium && !isMe ? 'bg-cream-100/50' : ''}`}
                    >
                      {/* Rank */}
                      <span className={`font-display uppercase leading-none flex-shrink-0 w-8 text-center
                        ${rank === 1 ? 'text-gold-500 text-2xl' : rank === 2 ? 'text-charcoal-500 text-xl' : rank === 3 ? 'text-ember-500 text-xl' : 'text-night-300 text-lg'}`}>
                        {rank}
                      </span>

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-night-900 flex-shrink-0 bg-night-700 flex items-center justify-center shadow-sticker-sm">
                        {row.avatar_url ? (
                          <img src={row.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-extrabold text-cream-50 uppercase">
                            {(row.display_name ?? '?').charAt(0)}
                          </span>
                        )}
                      </div>

                      {/* Name + stat */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-extrabold uppercase tracking-crowd text-night-900 truncate">
                          {row.display_name ?? 'Anonymous'}
                          {isMe && <span className="ml-1.5 text-sauce-400 text-[10px]">YOU</span>}
                        </p>
                        <p className="text-[11px] text-charcoal-500 font-medium">
                          {catDef.stat(row)}
                        </p>
                      </div>

                      {/* Podium badge */}
                      {rank === 1 && <span className="text-xl flex-shrink-0">👑</span>}
                      {rank === 2 && <span className="text-xl flex-shrink-0">🥈</span>}
                      {rank === 3 && <span className="text-xl flex-shrink-0">🥉</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
