import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useBottomSheetDrag, useIsMobile } from '../hooks/useBottomSheetDrag'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useHideFab } from '../hooks/useHideFab'
import { useBadges } from '../hooks/useBadges'
import { useLeaderboard } from '../hooks/useLeaderboard'
import BadgeGrid from './badges/BadgeGrid'
import BadgeIcon from './badges/BadgeIcon'
import AvatarImage from './ui/AvatarImage'
import { changePassword, deleteOwnAccount, hasPasswordLogin, verifyCurrentPassword, type AuthState } from '../hooks/useAuth'
import { displayNameProblem, MIN_PASSWORD_LENGTH, passwordProblem } from '../lib/authErrors'
import { PROFILE_LINK_PREFIX, USERNAME_MAX, USERNAME_TAKEN_MESSAGE, usernameProblem, usernameSaveError } from '../lib/profileHandle'
import { formatRating } from '../lib/formatRating'
import { BADGES_UNLOCKED_EVENT } from '../lib/badgeUnlocks'
import { validateImageFile } from '../lib/imageValidation'
import { AVATAR_MAX_SIDE, downscaleImage, imageExtension } from '../lib/imageResize'
import { useKeyboardViewport } from '../hooks/useKeyboardViewport'

interface Props {
  auth: AuthState
  onClose: () => void
}

type Tab = 'profile' | 'badges' | 'stats'
// Account actions open in place of the profile form, inside the same sheet.
type AccountPanel = null | 'password' | 'delete'

export const DELETE_CONFIRM_WORD = 'DELETE'
export const DISCARD_PROFILE_CHANGES = 'Discard your changes? Your profile edits will be lost.'

export default function ProfileModal({ auth, onClose }: Props) {
  const profile = auth.profile
  const user = auth.user

  const initialName = profile?.display_name ?? profile?.full_name ?? ''
  const initialBio = profile?.bio ?? ''
  const initialPrivate = profile?.is_private ?? false
  const initialUsername = profile?.username ?? ''

  // Edits left unsaved by browser Back (or a reload) come back next time.
  const draftKey = `profile-edit-draft:${user?.id ?? ''}`
  const [draft] = useState(() => readProfileDraft(draftKey, {
    displayName: initialName, bio: initialBio, isPrivate: initialPrivate, username: initialUsername,
  }))

  const [tab, setTab] = useState<Tab>('profile')
  const [displayName, setDisplayName] = useState(draft?.displayName ?? initialName)
  const [bio, setBio] = useState(draft?.bio ?? initialBio)
  const [isPrivate, setIsPrivate] = useState(draft?.isPrivate ?? initialPrivate)
  const [username, setUsername] = useState(draft?.username ?? initialUsername)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [panel, setPanel] = useState<AccountPanel>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // The Account buttons sit at the bottom of a scrolled form; start the panel
  // they open (and the form, on the way back) at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo?.(0, 0)
  }, [panel])

  const usernameChanged = username !== initialUsername
  // Checked as you type, so Save never sends a username the database will
  // refuse: the format rules at once (shown when typing pauses), whether
  // someone else has it after a short lookup.
  const usernameCheck = useUsernameCheck(usernameChanged ? username : null, user?.id, auth.isAdmin)
  const usernameBlocked = usernameChanged && usernameCheck.status !== 'ok'
  const isDirty = displayName !== initialName || bio !== initialBio || isPrivate !== initialPrivate
    || usernameChanged || !!avatarFile
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty && !saving

  // Unsaved edits: ask before throwing them away (Cancel, ×, backdrop), like
  // the review form's "Discard your review?".
  const requestClose = () => {
    if (dirtyRef.current) {
      if (!window.confirm(DISCARD_PROFILE_CHANGES)) return
      clearProfileDraft(draftKey)
      dirtyRef.current = false
    }
    onClose()
  }

  // Keep a draft while there are edits (text fields only; a picked photo
  // can't be stored). Browser Back closes the sheet through the opener's
  // useHistoryModal, which this sheet can't veto, so the edits are kept
  // instead and restored the next time Edit profile opens.
  useEffect(() => {
    if (!user?.id) return
    const fieldsDirty = displayName !== initialName || bio !== initialBio
      || isPrivate !== initialPrivate || username !== initialUsername
    if (fieldsDirty) writeProfileDraft(draftKey, { displayName, bio, isPrivate, username })
    else clearProfileDraft(draftKey)
  }, [draftKey, user?.id, displayName, bio, isPrivate, username, initialName, initialBio, initialPrivate, initialUsername])

  // Closed with edits still unsaved (browser Back, a route change): say
  // they were kept. Cancel/× after "Discard" and Save clear dirtyRef first.
  useEffect(() => () => {
    if (dirtyRef.current) {
      toast('Your profile changes are not saved yet. Open Edit profile to finish them.', { id: 'profile-draft' })
    }
  }, [])

  // Reload / closing the tab with unsaved edits: the browser's own warning.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])


  const { expanded, handleProps, sheetStyle } = useBottomSheetDrag({
    defaultMaxHeight: 'calc(92dvh - env(safe-area-inset-top))',
  })
  const panelRef = useFocusTrap<HTMLDivElement>()
  // Escape closes like Cancel (asking first when there are unsaved edits).
  // Skipped while a nested dialog (e.g. a badge's details) owns focus.
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const panel = panelRef.current
      if (panel && document.activeElement && !panel.contains(document.activeElement) && document.activeElement !== document.body) return
      requestCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panelRef])
  useHideFab(true)

  // Phone keyboard: lift the sheet above it (same as ui/Modal), and bring a
  // focused field up to the top of the sheet's scroll area so it isn't left
  // under the keyboard (the Bio box sat at y≈480–557 on a 375×667 phone).
  const isMobile = useIsMobile()
  const keyboardBox = useKeyboardViewport(isMobile)
  const revealField = (e: React.FocusEvent<HTMLElement>) => {
    if (!isMobile) return
    const field = (e.currentTarget.closest('[data-field]') as HTMLElement | null) ?? e.currentTarget
    const reveal = () => {
      const area = scrollRef.current
      if (!area || !area.contains(field)) return
      const offset = field.getBoundingClientRect().top - area.getBoundingClientRect().top
      if (offset > 8 || offset < 0) area.scrollTo?.({ top: area.scrollTop + offset - 8, behavior: 'smooth' })
    }
    reveal()
    // Again once the keyboard has opened and the sheet has been lifted.
    window.setTimeout(reveal, 350)
  }

  const badgesHook = useBadges(user?.id)
  // Badges unlocked while the sheet is open (or just before, still being
  // announced) — count them straight away, not on the next open.
  const refreshBadges = badgesHook.refresh
  useEffect(() => {
    const onUnlock = () => { void refreshBadges() }
    window.addEventListener(BADGES_UNLOCKED_EVENT, onUnlock)
    return () => window.removeEventListener(BADGES_UNLOCKED_EVENT, onUnlock)
  }, [refreshBadges])
  const badgesKnown = !badgesHook.loading || badgesHook.badges.length > 0
  const { rows: leaderRows, loading: lbLoading } = useLeaderboard(user?.id)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [followingCount, setFollowingCount] = useState<number | null>(null)

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
    // No count until it has loaded: "Badges · 0" right after earning some
    // looked like they were lost (m2 mobile 9).
    { key: 'badges',  label: badgesKnown ? `Badges · ${badgesHook.earned.length}` : 'Badges' },
    { key: 'stats',   label: 'Stats' },
  ]

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again after an error
    if (!file) return
    // Decode it: a renamed non-image passes the type check and would be
    // saved as a broken avatar everywhere.
    const problem = await validateImageFile(file, 5)
    if (problem) { toast.error(problem); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  // Like ui/Modal: publish the pinned Save bar's height so toasts (App.tsx)
  // sit above it instead of on top of Save/Cancel.
  const saveBarRef = useRef<HTMLDivElement>(null)
  const showSaveBar = tab === 'profile' && !panel
  useEffect(() => {
    const el = saveBarRef.current
    const root = document.documentElement
    if (!showSaveBar || !el) return
    const set = () => root.style.setProperty('--wkt-sheet-footer', `${el.offsetHeight}px`)
    set()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      root.style.removeProperty('--wkt-sheet-footer')
    }
  }, [showSaveBar])

  const handleSave = async () => {
    if (!user) return
    const trimmedName = displayName.trim()
    const problem = displayNameProblem(trimmedName)
    if (problem) { setNameError(problem); return }
    setNameError(null)
    // Save is disabled while the username can't be used; this is the
    // keyboard-Enter / race safety net, and never sends a doomed request.
    if (usernameBlocked) return
    setUsernameError(null)
    setSaving(true)
    try {
      // Username first, on its own: it is the one change the database can
      // refuse (taken / reserved), and the error belongs under its field.
      if (usernameChanged) {
        const { data: row, error: handleError } = await supabase
          .from('profiles').update({ username }).eq('id', user.id).select('username').maybeSingle()
        if (handleError || !row) {
          setUsernameError(handleError ? usernameSaveError(handleError) : usernameSaveError({}))
          return
        }
      }
      let avatarUrl: string | undefined
      if (avatarFile) {
        const upload = await downscaleImage(avatarFile, { maxSide: AVATAR_MAX_SIDE })
        const path = `${user.id}/avatar.${imageExtension(upload)}`
        const { error: uploadError } = await supabase.storage
          .from('user-avatars').upload(path, upload, { upsert: true, contentType: upload.type })
        if (uploadError) { toast.error('Failed to upload photo') }
        else {
          const { data } = supabase.storage.from('user-avatars').getPublicUrl(path)
          // Same path on every upload: without a version the browser keeps
          // showing the old cached photo.
          avatarUrl = `${data.publicUrl}?v=${Date.now()}`
        }
      }
      const ok = await auth.updateProfile({
        display_name: trimmedName,
        // '' (not undefined) so clearing the bio actually saves.
        bio: bio.trim().slice(0, 140),
        is_private: isPrivate,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })
      if (!ok) return // updateProfile already showed the error
      // updateProfile's local merge doesn't know the new username.
      if (usernameChanged) await auth.refreshProfile()
      dirtyRef.current = false
      clearProfileDraft(draftKey)
      toast.success('Profile updated')
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-night-900/70 backdrop-blur-sm" onClick={requestClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center p-0 sm:p-6"
        style={keyboardBox
          ? { top: keyboardBox.top, height: keyboardBox.height, bottom: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }
          : undefined}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
          tabIndex={-1}
          className="w-full sm:max-w-sm bg-cream-50 sm:rounded-2xl sm:border-2 sm:border-night-900 sm:shadow-sticker overflow-hidden flex flex-col animate-slide-up focus:outline-none"
          style={{
            ...sheetStyle,
            ...(keyboardBox ? { maxHeight: 'calc(100% - env(safe-area-inset-top))' } : {}),
          }}
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
                className="relative w-14 h-14 flex-shrink-0 group"
                aria-label="Change profile photo"
              >
                <span className="w-14 h-14 rounded-full overflow-hidden border-2 border-night-900 shadow-sticker-sm bg-night-700 flex items-center justify-center">
                  <AvatarImage
                    src={currentAvatar}
                    alt={name}
                    className="w-full h-full object-cover"
                    fallback={<span className="text-xl font-extrabold text-cream-50">{initials}</span>}
                  />
                </span>
                {/* A small corner badge instead of a label across the middle,
                    so it never covers the initial or the photo. */}
                <span
                  aria-hidden
                  className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md border-2 border-night-900 bg-cream-50 text-night-900 text-[9px] font-extrabold uppercase tracking-crowd leading-none shadow-sticker-sm group-hover:bg-sauce-400 group-hover:text-cream-50 transition-colors"
                >
                  Edit
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

              <div className="flex-1 min-w-0">
                <p className="font-display uppercase tracking-wide text-xl text-night-900 leading-tight truncate">{name}</p>
                <p className="text-[11px] text-charcoal-500 truncate mt-0.5">{email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {auth.isAdmin && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md border-2 border-night-900 bg-sauce-400 text-cream-50 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm">
                      Admin
                    </span>
                  )}
                  {badgesHook.earned.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('badges')}
                      className="inline-flex items-center gap-1.5 py-3 -my-3 text-[10px] text-charcoal-500 font-bold hover:text-sauce-500 transition-colors"
                    >
                      {badgesHook.earned.slice(0, 3).map(b => (
                        <span key={b.id} title={b.name} className="text-base leading-none inline-flex">
                          <BadgeIcon icon={b.icon} className="w-4 h-4" />
                        </span>
                      ))}
                      <span>{badgesHook.earned.length} badge{badgesHook.earned.length !== 1 ? 's' : ''} →</span>
                    </button>
                  )}
                  {followerCount !== null && followingCount !== null && (
                    <>
                      <span className="text-[10px] text-charcoal-500 font-bold">
                        {followerCount} follower{followerCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[10px] text-charcoal-500 font-bold">
                        {followingCount} following
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={requestClose}
                aria-label="Close"
                className="w-11 h-11 -mr-1.5 -mt-1.5 rounded-lg text-night-700 flex items-center justify-center flex-shrink-0 self-start hover:bg-cream-200 transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-cream-100 border border-night-900/20 flex items-center justify-center text-lg">×</span>
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b-2 border-night-900/10 -mx-5 px-5">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setPanel(null) }}
                  className={`mr-4 min-h-[44px] pb-2.5 pt-2 text-[11px] font-extrabold uppercase tracking-crowd transition-colors border-b-2 -mb-[2px]
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
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">

            {/* ── Profile tab ─────────────────────────────────────── */}
            {tab === 'profile' && panel === 'password' && user && (
              <ChangePasswordPanel email={email} onDone={() => setPanel(null)} />
            )}

            {tab === 'profile' && panel === 'delete' && user && (
              <DeleteAccountPanel
                userId={user.id}
                email={email}
                needsPassword={hasPasswordLogin(user)}
                isAdmin={auth.isAdmin}
                onCancel={() => setPanel(null)}
              />
            )}

            {tab === 'profile' && !panel && (
              <div className="space-y-4">
                {draft && (
                  <p role="status" className="text-xs font-bold text-night-900 bg-gold-100 border-2 border-night-900/20 rounded-lg px-3 py-2">
                    You have changes you didn’t save last time. Choose Save to keep them, or Cancel to discard them.
                  </p>
                )}
                <div>
                  <label className="label" htmlFor="profile-display-name">Display name</label>
                  <input
                    id="profile-display-name"
                    type="text"
                    value={displayName}
                    onChange={e => { setDisplayName(e.target.value); setNameError(displayNameProblem(e.target.value.trim())) }}
                    placeholder="Your name"
                    className="input"
                    maxLength={60}
                    disabled={saving}
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={nameError ? 'profile-name-error' : undefined}
                  />
                  {nameError && (
                    <p id="profile-name-error" role="alert" className="text-[11px] font-bold text-sauce-600 mt-1">{nameError}</p>
                  )}
                </div>
                <div data-field>
                  <label className="label" htmlFor="profile-username">Username</label>
                  <div className="flex items-stretch rounded-lg overflow-hidden">
                    <span aria-hidden className="flex items-center pl-3 pr-1 text-sm text-charcoal-500 bg-cream-100 border-2 border-r-0 border-night-900 rounded-l-lg select-none">@</span>
                    <input
                      id="profile-username"
                      type="text"
                      value={username}
                      onChange={e => { setUsername(e.target.value.toLowerCase().replace(/^\s+/, '').replace(/\s+/g, '-')); setUsernameError(null) }}
                      onBlur={() => setUsername(u => u.replace(/-+$/, ''))}
                      onFocus={revealField}
                      data-reveal-handled
                      className="input rounded-l-none min-w-0"
                      maxLength={USERNAME_MAX}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={saving}
                      aria-invalid={usernameError || usernameCheck.message ? true : undefined}
                      aria-describedby="profile-username-help"
                    />
                  </div>
                  {usernameError || usernameCheck.message ? (
                    <p id="profile-username-help" role="alert" className="text-[11px] font-bold text-sauce-600 mt-1">
                      {usernameError ?? usernameCheck.message}
                      {(usernameError ?? usernameCheck.message) === USERNAME_TAKEN_MESSAGE && ' For example, add a number at the end.'}
                    </p>
                  ) : (
                    <p id="profile-username-help" className="text-[11px] text-charcoal-500 mt-1 leading-snug" aria-live="polite">
                      {usernameChanged && usernameCheck.status !== 'ok' ? (
                        // Still typing or still checking: no link, no promise yet.
                        usernameCheck.status === 'checking' ? 'Checking if this username is free…' : 'Small letters a–z, numbers and hyphens (-), 3 to 30 characters.'
                      ) : (
                        <>
                          Your profile link: <strong className="text-night-900 font-bold [overflow-wrap:anywhere]">{PROFILE_LINK_PREFIX}{username || '…'}</strong>
                          <br />
                          {usernameChanged
                            ? 'This username is available. Your old link will keep working and send people to the new one.'
                            : 'Small letters a–z, numbers and hyphens (-), 3 to 30 characters.'}
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div data-field>
                  <label className="label" htmlFor="profile-bio">Bio</label>
                  <textarea
                    id="profile-bio"
                    value={bio}
                    onChange={e => setBio(e.target.value.slice(0, 140))}
                    onFocus={revealField}
                    data-reveal-handled
                    placeholder="A few words about you (optional)"
                    rows={2}
                    className="input resize-none"
                    disabled={saving}
                  />
                  <p className="text-[10px] text-charcoal-400 mt-1 text-right tabular-nums">
                    {bio.length}/140
                  </p>
                </div>
                <div>
                  <label className="label">Email</label>
                  <p className="text-sm font-medium text-charcoal-600 px-4 py-3 bg-cream-100 rounded-lg border border-night-900/15 break-all">
                    {email}
                  </p>
                  <p className="text-[11px] text-charcoal-500 mt-1">Only you and the site admin can see this. It’s never shown publicly.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPrivate}
                  onClick={() => setIsPrivate(p => !p)}
                  className="w-full flex items-center justify-between gap-3 text-left py-3 px-4 rounded-xl border border-night-900/15 bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauce-400"
                >
                  <div>
                    <p className="text-sm font-extrabold text-night-900">Private profile</p>
                    <p className="text-[11px] text-charcoal-500 mt-0.5 leading-snug">
                      Other people can’t open your profile page, and your name is hidden on
                      event attendee lists and wing lists. Your reviews stay public and still
                      show your name in the feed and the People list.
                    </p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isPrivate ? 'bg-sauce-400' : 'bg-night-900/20'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sticker-sm mt-0.5 transition-transform ${isPrivate ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </div>
                </button>

                {/* ── Account ─────────────────────────────────────── */}
                <div className="pt-2">
                  <p className="eyebrow mb-2">Account</p>
                  <div className="rounded-xl border border-night-900/15 bg-cream-100 divide-y divide-night-900/10 overflow-hidden">
                    {hasPasswordLogin(user) && (
                      <button
                        type="button"
                        onClick={() => setPanel('password')}
                        className="w-full min-h-[48px] px-4 flex items-center justify-between text-left text-sm font-bold text-night-900 hover:bg-cream-200 transition-colors"
                      >
                        Change password <span aria-hidden>→</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPanel('delete')}
                      className="w-full min-h-[48px] px-4 flex items-center justify-between text-left text-sm font-bold text-sauce-600 hover:bg-sauce-50 transition-colors"
                    >
                      Delete account <span aria-hidden>→</span>
                    </button>
                  </div>
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

                    {(() => {
                      const earnedEvent = badgesHook.earned.filter(b => b.event_id)
                      const earnedRegular = badgesHook.earned.filter(b => !b.event_id)
                      return (
                        <>
                          {earnedEvent.length > 0 && (
                            <div className="mb-6">
                              <p className="eyebrow mb-3 text-gold-500">★ Event exclusives</p>
                              <BadgeGrid badges={earnedEvent} />
                            </div>
                          )}
                          {earnedRegular.length > 0 && (
                            <div className="mb-6">
                              <BadgeGrid badges={earnedRegular} />
                            </div>
                          )}
                        </>
                      )
                    })()}

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
                    <p className="eyebrow mb-3">Your stats</p>

                    <div className="grid grid-cols-2 gap-2.5">
                      <StatCard emoji="🍗" label="Reviews posted" value={myRow.review_count} />
                      <StatCard emoji="📍" label="Unique spots"   value={myRow.unique_spots} />
                      <StatCard emoji="⭐" label="Average rating"     value={formatRating(myRow.avg_rating)} />
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
                          { label: 'Highest average rating', key: 'heat',     val: formatRating(myRow.avg_rating) },
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

          {/* Save bar: outside the scroll area so it's always on screen,
              even on a short phone where the form scrolls. */}
          {tab === 'profile' && !panel && (
            <div
              ref={saveBarRef}
              className="flex-shrink-0 flex gap-3 px-5 pt-3 border-t-2 border-night-900/10 bg-cream-50"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
            >
              <button onClick={requestClose} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || usernameBlocked}
                aria-describedby={usernameBlocked ? 'profile-username-help' : undefined}
                className="btn-primary flex-1"
              >
                {saving && <span className="w-4 h-4 rounded-full border-2 border-cream-50 border-t-transparent animate-spin" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Username check as you type ─────────────────────────────────────────────

type UsernameCheck =
  | { status: 'ok'; message: null }
  /** Typing, or waiting for the lookup: Save waits too. */
  | { status: 'checking' | 'typing'; message: null }
  | { status: 'problem'; message: string }

const USERNAME_CHECK_DELAY_MS = 400
// Mirrors migration 042: at most 3 username changes in 30 days (non-admins).
const MAX_RENAMES = 3
const RENAME_WINDOW_DAYS = 30
const RENAME_LIMIT_MESSAGE = 'You can change your username up to 3 times in 30 days. Try again later.'

/**
 * Whether `name` (null = unchanged, nothing to check) can be saved. Format
 * problems block Save at once but are only shown once typing pauses (so
 * "sam-" on the way to "sam-doubts" doesn't flash an error). Availability
 * is looked up after the same pause; a failed lookup lets Save try anyway
 * (the server still decides, and its answer is shown under the field).
 */
function useUsernameCheck(name: string | null, userId: string | undefined, isAdmin = false): UsernameCheck {
  const [settled, setSettled] = useState<{ name: string; result: UsernameCheck } | null>(null)

  const formatProblem = name === null ? null : usernameProblem(name)
  // Admins may use reserved words (042); the server checks the rest.
  const reservedOnly = formatProblem !== null && isAdmin && formatProblem.includes('reserved')

  useEffect(() => {
    if (name === null) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (formatProblem && !reservedOnly) {
        setSettled({ name, result: { status: 'problem', message: formatProblem } })
        return
      }
      try {
        // Renames in the last 30 days: the server (042) refuses a 4th for
        // non-admins, so say so now instead of after Save.
        const since = new Date(Date.now() - RENAME_WINDOW_DAYS * 86_400_000).toISOString()
        const [current, old, recent] = await Promise.all([
          supabase.from('profiles').select('id').eq('username', name).limit(1),
          supabase.from('profile_username_history').select('user_id').eq('username', name).limit(1),
          !isAdmin && userId
            ? supabase.from('profile_username_history').select('username', { count: 'exact', head: true })
                .eq('user_id', userId).gt('changed_at', since)
            : Promise.resolve({ count: 0, error: null }),
        ])
        if (cancelled) return
        if (current.error || old.error) throw current.error ?? old.error
        const owner = (current.data as { id: string }[] | null)?.[0]?.id
          ?? (old.data as { user_id: string }[] | null)?.[0]?.user_id
          ?? null
        const result: UsernameCheck = owner && owner !== userId
          ? { status: 'problem', message: USERNAME_TAKEN_MESSAGE }
          : (recent.count ?? 0) >= MAX_RENAMES
            ? { status: 'problem', message: RENAME_LIMIT_MESSAGE }
            : { status: 'ok', message: null }
        setSettled({ name, result })
      } catch {
        if (!cancelled) setSettled({ name, result: { status: 'ok', message: null } })
      }
    }, USERNAME_CHECK_DELAY_MS)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [name, userId, isAdmin, formatProblem, reservedOnly])

  if (name === null) return { status: 'ok', message: null }
  if (settled?.name === name) return settled.result
  return { status: formatProblem && !reservedOnly ? 'typing' : 'checking', message: null }
}

// ── Unsaved-edit draft (sessionStorage, per tab and per user) ──────────────

interface ProfileDraft {
  displayName: string
  bio: string
  isPrivate: boolean
  username: string
}

function readProfileDraft(key: string, current: ProfileDraft): ProfileDraft | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<ProfileDraft>
    const draft: ProfileDraft = {
      displayName: typeof d.displayName === 'string' ? d.displayName : current.displayName,
      bio: typeof d.bio === 'string' ? d.bio.slice(0, 140) : current.bio,
      isPrivate: typeof d.isPrivate === 'boolean' ? d.isPrivate : current.isPrivate,
      username: typeof d.username === 'string' ? d.username : current.username,
    }
    const same = (Object.keys(draft) as (keyof ProfileDraft)[]).every(k => draft[k] === current[k])
    return same ? null : draft
  } catch {
    return null
  }
}

function writeProfileDraft(key: string, draft: ProfileDraft) {
  try { sessionStorage.setItem(key, JSON.stringify(draft)) } catch { /* storage off */ }
}

function clearProfileDraft(key: string) {
  try { sessionStorage.removeItem(key) } catch { /* storage off */ }
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

// ── Account panels ───────────────────────────────────────────────────────────

function ChangePasswordPanel({ email, onDone }: { email: string; onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nextProblem = next ? passwordProblem(next) : null
  const mismatch = confirm.length > 0 && confirm !== next
  const canSubmit = !!current && !!next && !nextProblem && confirm === next && !busy

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const { error } = await changePassword(email, current, next)
    setBusy(false)
    if (error) { setError(error); return }
    toast.success('Password changed')
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" onClick={onDone} className="min-h-[44px] -mt-2 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:text-night-900">
        ← Back to profile
      </button>
      <h3 className="font-display uppercase tracking-wide text-xl text-night-900">Change password</h3>
      {error && (
        <p role="alert" className="text-xs font-bold text-sauce-600 bg-sauce-50 border-2 border-sauce-500 rounded-lg px-3 py-2">{error}</p>
      )}
      <div>
        <label className="label" htmlFor="pw-current">Current password</label>
        <input id="pw-current" type="password" autoComplete="current-password" className="input"
          value={current} onChange={e => setCurrent(e.target.value)} disabled={busy} />
      </div>
      <div>
        <label className="label" htmlFor="pw-new">New password</label>
        <input id="pw-new" type="password" autoComplete="new-password" className="input"
          value={next} onChange={e => setNext(e.target.value)} disabled={busy}
          aria-describedby="pw-new-help" aria-invalid={nextProblem ? true : undefined} />
        <p id="pw-new-help" className={`text-[11px] mt-1 ${nextProblem ? 'font-bold text-sauce-600' : 'text-charcoal-500'}`}>
          {nextProblem ?? `At least ${MIN_PASSWORD_LENGTH} characters.`}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="pw-confirm">Type the new password again</label>
        <input id="pw-confirm" type="password" autoComplete="new-password" className="input"
          value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy}
          aria-invalid={mismatch || undefined} />
        {mismatch && <p className="text-[11px] font-bold text-sauce-600 mt-1">The two new passwords don’t match.</p>}
      </div>
      <button type="submit" disabled={!canSubmit} className="btn-primary w-full py-3">
        {busy ? 'Changing…' : 'Change password'}
      </button>
    </form>
  )
}

function DeleteAccountPanel({ userId, email, needsPassword, isAdmin, onCancel }: {
  userId: string
  email: string
  /** Email/password accounts confirm with their password, like Change password. */
  needsPassword: boolean
  isAdmin: boolean
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmed = typed.trim().toUpperCase() === DELETE_CONFIRM_WORD && (!needsPassword || !!password)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmed || busy || isAdmin) return
    setBusy(true)
    setError(null)
    if (needsPassword) {
      const wrong = await verifyCurrentPassword(email, password)
      if (wrong) {
        setBusy(false)
        setError(wrong)
        return
      }
    }
    const { error } = await deleteOwnAccount(userId)
    if (error) {
      setBusy(false)
      setError(error)
      return
    }
    // The toast wouldn't survive the reload, so App shows it after it loads.
    try { sessionStorage.setItem('account-deleted', '1') } catch { /* ignore */ }
    // Full reload: drops every cached feed, profile and modal history entry
    // that still refers to the deleted user.
    window.location.replace('/')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" onClick={onCancel} disabled={busy} className="min-h-[44px] -mt-2 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:text-night-900">
        ← Back to profile
      </button>
      <h3 className="font-display uppercase tracking-wide text-xl text-sauce-600">Delete account</h3>
      <div className="text-sm text-charcoal-700 leading-relaxed space-y-2">
        <p>This permanently deletes your account and everything you posted:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-[13px]">
          <li>your profile, photo and bio, and your profile links (old usernames too)</li>
          <li>your reviews and review photos</li>
          <li>your comments, likes and reactions</li>
          <li>your wing lists, follows, event RSVPs and check-ins</li>
          <li>your badges, notifications and settings</li>
        </ul>
        <p>Spots you added stay on the map, without your name. <strong>This can’t be undone.</strong></p>
      </div>
      {isAdmin ? (
        <p className="text-xs font-bold text-night-800 bg-cream-100 border-2 border-night-900/20 rounded-lg px-3 py-2">
          Admin accounts can’t be deleted here. Remove your admin rights first.
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="text-xs font-bold text-sauce-600 bg-sauce-50 border-2 border-sauce-500 rounded-lg px-3 py-2">{error}</p>
          )}
          {needsPassword && (
            <div>
              <label className="label" htmlFor="delete-password">Your password</label>
              <input id="delete-password" type="password" autoComplete="current-password" className="input"
                value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="delete-confirm">Type {DELETE_CONFIRM_WORD} to confirm</label>
            <input id="delete-confirm" type="text" autoComplete="off" autoCapitalize="characters" className="input"
              value={typed} onChange={e => setTyped(e.target.value)} disabled={busy} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary flex-1">Cancel</button>
            <button
              type="submit"
              disabled={!confirmed || busy}
              className="btn flex-1 py-3 bg-sauce-600 text-cream-50 border-2 border-night-900 shadow-sticker-sm disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
