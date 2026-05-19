import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useBottomSheetDrag } from '../hooks/useBottomSheetDrag'
import { useBadges } from '../hooks/useBadges'
import BadgeGrid from './badges/BadgeGrid'
import type { AuthState } from '../hooks/useAuth'

interface Props {
  auth: AuthState
  onClose: () => void
}

export default function ProfileModal({ auth, onClose }: Props) {
  const profile = auth.profile
  const user = auth.user

  const [displayName, setDisplayName] = useState(
    profile?.display_name ?? profile?.full_name ?? ''
  )
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { expanded, handleProps, sheetStyle } = useBottomSheetDrag({
    defaultMaxHeight: 'calc(90dvh - env(safe-area-inset-top))',
  })

  const badgesHook = useBadges(user?.id)

  const currentAvatar = avatarPreview ?? profile?.avatar_url ?? null
  const name = profile?.display_name ?? profile?.full_name ?? user?.email ?? ''
  const email = user?.email ?? ''

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5 MB')
      return
    }
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
          .from('user-avatars')
          .upload(path, avatarFile, { upsert: true })

        if (uploadError) {
          toast.error('Failed to upload photo')
        } else {
          const { data } = supabase.storage.from('user-avatars').getPublicUrl(path)
          avatarUrl = data.publicUrl
        }
      }

      await auth.updateProfile({
        display_name: displayName.trim() || undefined,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })

      toast.success('Profile updated')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-charcoal-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center p-4">
        <div
          className="w-full max-w-sm bg-white rounded-3xl shadow-elevated overflow-hidden animate-slide-up flex flex-col"
          style={sheetStyle}
        >
          {/* Handle */}
          <div
            className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
            role="slider"
            aria-label={expanded ? 'Drag down to collapse' : 'Drag up to expand'}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={expanded ? 1 : 0}
            tabIndex={0}
            {...handleProps}
          >
            <div className={`w-10 h-1 rounded-full transition-colors duration-200 ${expanded ? 'bg-warmgray-300' : 'bg-warmgray-200'}`} />
          </div>

          <div className="px-6 py-5 overflow-y-auto flex-1">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl text-charcoal-800">My Profile</h2>
              <button onClick={onClose} className="btn-ghost w-8 h-8 p-0 text-charcoal-400 text-lg">
                ×
              </button>
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2 mb-6">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-warmgray-200 hover:ring-amber-300 transition-all flex items-center justify-center bg-warmgray-100 relative group"
              >
                {currentAvatar ? (
                  <img src={currentAvatar} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-semibold text-charcoal-400">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <span className="text-white text-xs font-semibold">Change</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs text-amber-500 hover:underline"
              >
                {currentAvatar ? 'Change photo' : 'Add profile photo'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Display name */}
            <div className="mb-4">
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

            {/* Email (read-only) */}
            <div className="mb-6">
              <label className="label">Email</label>
              <p className="text-sm text-charcoal-500 px-4 py-3 bg-warmgray-50 rounded-xl border border-warmgray-200">
                {email}
              </p>
            </div>

            {/* Status */}
            {profile && (
              <div className="mb-6 flex items-center gap-2">
                <span className="text-xs text-charcoal-400 font-medium">Account status:</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  profile.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                </span>
                {auth.isAdmin && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-600">
                    Admin
                  </span>
                )}
              </div>
            )}

            {/* Badges */}
            {badgesHook.badges.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="font-display text-base text-charcoal-800">Badges</h3>
                  <span className="text-xs text-charcoal-400 font-medium">
                    {badgesHook.earned.length}/{badgesHook.badges.length}
                  </span>
                </div>
                <BadgeGrid badges={badgesHook.badges} />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex-1"
              >
                {saving ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-amber-200 animate-spin" />
                ) : null}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
