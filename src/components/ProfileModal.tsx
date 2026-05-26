import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useBottomSheetDrag } from '../hooks/useBottomSheetDrag'
import { useBadges } from '../hooks/useBadges'
import { useLeaderboard } from '../hooks/useLeaderboard'
import BadgeGrid from './badges/BadgeGrid'
import type { AuthState } from '../hooks/useAuth'

interface Props {
  auth: AuthState
  onClose: () => void
}

type Tab = 'profile' | 'badges' | 'stats'

export default function ProfileModal({ auth, onClose }: Props) {
  const profile = auth.profile
  const user = auth.user

  const [tab, setTab] = useState<Tab>('profile')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? profile?.full_name ?? '')
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { expanded, handleProps, sheetStyle } = useBottomSheetDrag({
    defaultMaxHeight: 'calc(92dvh - env(safe-area-inset-top))',
  })

  const badgesHook = useBadges(user?.id)
  const { rows: leaderRows, loading: lbLoading } = useLeaderboard(user?.id)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
    ]).then(([followerRes, followingRes]) => {
      setFollowerCount(followerRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)
    })
  }, [user?.id])
  const myRow = leaderRows.find(r => r.user_id === user?.id)

  const currentAvatar = avatarPreview ?? profile?.avatar_url ?? null
  const name  = profile?.display_name ?? profile?.full_name ?? user?.email ?? ''
  const email = user?.email ?? ''
  const initials = name.charAt(0).toUpperCase()

  const TABS: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'badges',  label: `Badges · ${badgesHook.earned.length}` },
    { key: 'stats',   label: 'Stats' },
  ]

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5 MB'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      let avatarUrl: string | undefined
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('user-avatars').upload(path, avatarFile, { upsert: true })
        if (uploadError) { toast.error('Failed to upload photo') }
        else {
          const { data } = supabase.storage.from('user-avatars').getPublicUrl(path)
          avatarUrl = data.publicUrl
        }
      }
      await auth.updateProfile({
        display_name: displayName.trim() || undefined,
        is_private: isPrivate,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })
      toast.success('Profile updated')
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-night-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center p-0 sm:p-6">
        <div
          className="w-full sm:max-w-sm bg-cream-50 sm:rounded-2xl sm:border-2 sm:border-night-900 sm:shadow-sticker overflow-hidden flex flex-col animate-slide-up"
          style={sheetStyle}
        >
          {/* Drag handle (mobile) */}
          <div
            className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
            role="slider" aria-label={expanded ? 'Drag down to collapse' : 'Drag up to expand'}
            aria-valuemin={0} aria-valuemax={1} aria-valuenow={expanded ? 1 : 0} tabIndex={0}
            {...handleProps}
          >
            <div className="w-10 h-1 rounded-full bg-night-900/20" />
          </div>

          {/* Header — avatar + name always visible */}
          <div className="flex-shrink-0 px-5 pt-3 pb-0">
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-night-900 shadow-sticker-sm flex-shrink-0 bg-night-700 group"
                aria-label="Change profile photo"
              >
                {currentAvatar ? (
                  <img src={currentAvatar} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-extrabold text-cream-50">{initials}</span>
                )}
                <div className="absolute inset-0 bg-night-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-cream-50 text-[10px] font-extrabold uppercase tracking-crowd">Edit</span>
                </div>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

              <div className="flex-1 min-w-0">
                <p className="font-display uppercase tracking-wide text-xl text-night-900 leading-tight truncate">{name}</p>
                <p className="text-[11px] text-charcoal-500 truncate mt-0.5">{email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {profile?.status === 'approved' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-night-900/20 bg-cream-100 text-[10px] font-extrabold uppercase tracking-crowd text-night-700">
                      Approved
                    </span>
                  )}
                  {auth.isAdmin && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md border-2 border-night-900 bg-sauce-400 text-cream-50 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm">
                      Admin
                    </span>
                  )}
                  {badgesHook.earned.length > 0 && (
                    <span className="text-[10px] text-charcoal-500 font-bold">
                      {badgesHook.earned.length} badge{badgesHook.earned.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-[10px] text-charcoal-500 font-bold">
                    {followerCount} follower{followerCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] text-charcoal-500 font-bold">
                    {followingCount} following
                  </span>
                </div>
              </div>

              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-cream-100 border border-night-900/20 text-night-700 flex items-center justify-center text-lg hover:bg-cream-200 transition-colors flex-shrink-0 self-start">×</button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b-2 border-night-900/10 -mx-5 px-5">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`mr-4 pb-2.5 text-[11px] font-extrabold uppercase tracking-crowd transition-colors border-b-2 -mb-[2px]
                    ${tab === t.key
                      ? 'border-sauce-400 text-sauce-500'
                      : 'border-transparent text-charcoal-400 hover:text-night-700'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">

            {/* ── Profile tab ─────────────────────────────────────── */}
            {tab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <label className="label">Display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="input"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <p className="text-sm font-medium text-charcoal-600 px-4 py-3 bg-cream-100 rounded-lg border border-night-900/15">
                    {email}
                  </p>
                </div>
                <div
                  className="flex items-center justify-between py-3 px-4 rounded-xl border border-night-900/15 bg-cream-100 cursor-pointer"
                  onClick={() => setIsPrivate(p => !p)}
                >
                  <div>
                    <p className="text-sm font-extrabold text-night-900">Private profile</p>
                    <p className="text-[11px] text-charcoal-500 mt-0.5">
                      Hide your name and photo from event attendee lists
                    </p>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${isPrivate ? 'bg-sauce-400' : 'bg-night-900/20'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sticker-sm mt-0.5 transition-transform ${isPrivate ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                    {saving && <span className="w-4 h-4 rounded-full border-2 border-cream-50 border-t-transparent animate-spin" />}
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Badges tab ──────────────────────────────────────── */}
            {tab === 'badges' && (
              <div>
                {badgesHook.loading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <p className="eyebrow">Earned</p>
                      <span className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-500">
                        {badgesHook.earned.length} / {badgesHook.badges.length}
                      </span>
                    </div>

                    {badgesHook.earned.length > 0 && (
                      <div className="mb-6">
                        <BadgeGrid badges={badgesHook.earned} />
                      </div>
                    )}

                    {badgesHook.locked.length > 0 && (
                      <>
                        <p className="eyebrow mb-3">Locked</p>
                        <BadgeGrid badges={badgesHook.locked} />
                      </>
                    )}

                    {badgesHook.badges.length === 0 && (
                      <div className="py-10 text-center">
                        <p className="text-4xl mb-3">🔒</p>
                        <p className="font-display uppercase tracking-wide text-xl text-night-900">No badges yet</p>
                        <p className="text-sm text-charcoal-500 mt-1">Post your first review to get started.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Stats tab ───────────────────────────────────────── */}
            {tab === 'stats' && (
              <div className="space-y-3">
                {lbLoading || !myRow ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    <p className="eyebrow mb-3">Your scene stats</p>

                    <div className="grid grid-cols-2 gap-2.5">
                      <StatCard emoji="🍗" label="Reviews posted" value={myRow.review_count} />
                      <StatCard emoji="📍" label="Unique spots"   value={myRow.unique_spots} />
                      <StatCard emoji="⭐" label="Avg rating"     value={myRow.avg_rating ?? '—'} />
                      <StatCard emoji="💬" label="Comments"       value={myRow.comment_count} />
                      <StatCard emoji="🏅" label="Badges earned"  value={myRow.badge_count} />
                      <StatCard emoji="❤️" label="Likes received" value={myRow.total_likes_received} />
                    </div>

                    {/* Leaderboard ranks */}
                    <div className="mt-5">
                      <p className="eyebrow mb-3">Your leaderboard ranks</p>
                      <div className="space-y-2">
                        {[
                          { label: 'Most reviews',  key: 'reviews',  val: myRow.review_count },
                          { label: 'Most spots',    key: 'spots',    val: myRow.unique_spots },
                          { label: 'Highest heat',  key: 'heat',     val: myRow.avg_rating ?? 0 },
                          { label: 'Most comments', key: 'comments', val: myRow.comment_count },
                          { label: 'Most badges',   key: 'badges',   val: myRow.badge_count },
                          { label: 'Most liked',    key: 'likes',    val: myRow.total_likes_received },
                        ].map(({ label, key, val }) => {
                          const sorted = [...leaderRows].sort((a, b) => {
                            const av = (a as any)[key === 'heat' ? 'avg_rating' : key === 'reviews' ? 'review_count' : key === 'spots' ? 'unique_spots' : key === 'comments' ? 'comment_count' : key === 'badges' ? 'badge_count' : 'total_likes_received'] ?? 0
                            const bv = (b as any)[key === 'heat' ? 'avg_rating' : key === 'reviews' ? 'review_count' : key === 'spots' ? 'unique_spots' : key === 'comments' ? 'comment_count' : key === 'badges' ? 'badge_count' : 'total_likes_received'] ?? 0
                            return bv - av
                          })
                          const rank = sorted.findIndex(r => r.user_id === user?.id) + 1
                          return (
                            <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-cream-100 border border-night-900/10">
                              <span className="text-xs font-bold text-charcoal-600">{label}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-charcoal-500">{val}</span>
                                <span className={`text-xs font-extrabold uppercase tracking-crowd px-2 py-0.5 rounded-md
                                  ${rank === 1 ? 'bg-gold-300 text-night-900' : rank <= 3 ? 'bg-sauce-400 text-cream-50' : 'bg-cream-200 text-night-700'}`}>
                                  #{rank}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-4 rounded-xl bg-night-800 border-2 border-night-900 shadow-sticker-sm text-center">
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="font-display uppercase tracking-wide text-2xl text-cream-50 leading-none mt-1">{value}</span>
      <span className="text-[9px] font-extrabold uppercase tracking-crowd text-cream-100/60">{label}</span>
    </div>
  )
}
