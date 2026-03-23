import { useState } from 'react'
import toast from 'react-hot-toast'
import type { UseNotificationsReturn } from '../hooks/useNotifications'
import { needsHomeScreenInstall, isIOS, getPermissionState } from '../lib/pushManager'

interface Props {
  notifications: UseNotificationsReturn
  onClose: () => void
}

export default function NotificationSettings({ notifications, onClose }: Props) {
  const {
    preferences,
    pushSubscribed,
    pushSupported,
    enablePush,
    disablePush,
    updatePreferences,
  } = notifications

  const [saving, setSaving] = useState(false)
  const permState = getPermissionState()

  const handleTogglePush = async () => {
    setSaving(true)
    try {
      if (pushSubscribed) {
        await disablePush()
        toast.success('Push notifications disabled')
      } else {
        const result = await enablePush()
        if (result.success) {
          toast.success('Push notifications enabled!')
        } else if (result.error) {
          toast.error(result.error)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePref = async (key: string, value: boolean) => {
    await updatePreferences({ [key]: value } as Record<string, boolean>)
  }

  const prefs = preferences

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-charcoal-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-elevated overflow-hidden animate-slide-up max-h-[85dvh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-warmgray-200" />
          </div>

          <div className="px-6 py-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl text-charcoal-800">Notifications</h2>
              <button onClick={onClose} className="btn-ghost w-8 h-8 p-0 text-charcoal-400 text-lg">
                ×
              </button>
            </div>

            {/* Push notification toggle */}
            <div className="mb-6">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal-700">Push notifications</p>
                  <p className="text-xs text-charcoal-400 mt-0.5">
                    {pushSubscribed
                      ? 'Receiving push on this device'
                      : 'Get alerts even when the app is closed'}
                  </p>
                </div>
                <button
                  onClick={handleTogglePush}
                  disabled={saving || !pushSupported}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                    pushSubscribed ? 'bg-amber-400' : 'bg-warmgray-300'
                  } ${!pushSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                  aria-label={pushSubscribed ? 'Disable push' : 'Enable push'}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      pushSubscribed ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Platform-specific messages */}
              {!pushSupported && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-1">
                  Push notifications are not supported in this browser.
                </p>
              )}

              {pushSupported && needsHomeScreenInstall() && (
                <div className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-1">
                  <p className="font-semibold">Add to Home Screen required</p>
                  <p className="mt-1">
                    On iPhone, push notifications only work when the app is added to your Home
                    Screen. Tap the Share button in Safari, then "Add to Home Screen."
                  </p>
                </div>
              )}

              {permState === 'denied' && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-1">
                  Notifications are blocked in your browser settings. You'll need to
                  allow notifications for this site in your browser or device settings.
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-warmgray-100 mb-4" />

            {/* Preference toggles */}
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3">
                Notify me about
              </p>

              <ToggleRow
                label="All notifications"
                description="Master switch for all notifications"
                checked={prefs?.enabled ?? true}
                onChange={(v) => handleTogglePref('enabled', v)}
              />

              <div className={prefs?.enabled === false ? 'opacity-40 pointer-events-none' : ''}>
                <ToggleRow
                  label="New reviews"
                  description="When someone posts a new wing review"
                  checked={prefs?.new_review ?? true}
                  onChange={(v) => handleTogglePref('new_review', v)}
                />

                <ToggleRow
                  label="Comments on my photos"
                  description="When someone comments on your photo"
                  checked={prefs?.photo_comment ?? true}
                  onChange={(v) => handleTogglePref('photo_comment', v)}
                />

                <ToggleRow
                  label="Replies in threads"
                  description="When someone replies on a photo you commented on"
                  checked={prefs?.comment_reply ?? true}
                  onChange={(v) => handleTogglePref('comment_reply', v)}
                />

                <ToggleRow
                  label="Photo likes"
                  description="When someone likes your photo"
                  checked={prefs?.photo_like ?? true}
                  onChange={(v) => handleTogglePref('photo_like', v)}
                />

                <ToggleRow
                  label="Comment likes"
                  description="When someone likes your comment"
                  checked={prefs?.comment_like ?? true}
                  onChange={(v) => handleTogglePref('comment_like', v)}
                />

                <ToggleRow
                  label="Comment reactions"
                  description="When someone reacts to your comment"
                  checked={prefs?.comment_react ?? true}
                  onChange={(v) => handleTogglePref('comment_react', v)}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-warmgray-100 my-3" />

              <ToggleRow
                label="Quiet mode"
                description="Record notifications in-app but suppress push alerts"
                checked={prefs?.quiet_mode ?? false}
                onChange={(v) => handleTogglePref('quiet_mode', v)}
              />
            </div>

            {/* iOS-specific info */}
            {isIOS() && (
              <div className="mt-5 text-xs text-charcoal-400 bg-warmgray-50 rounded-xl px-3 py-2.5 leading-relaxed">
                <p className="font-semibold text-charcoal-500 mb-1">iPhone tips</p>
                <p>
                  Push notifications on iPhone require iOS 16.4+ and the app must be added
                  to your Home Screen. Notifications may be delayed while in Low Power Mode.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Toggle row component ─────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0 pr-3">
        <p className="text-sm text-charcoal-700">{label}</p>
        <p className="text-xs text-charcoal-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0 ${
          checked ? 'bg-amber-400' : 'bg-warmgray-300'
        }`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <span
          className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[20px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </div>
  )
}
