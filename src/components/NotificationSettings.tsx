import { useState } from 'react'
import toast from 'react-hot-toast'
import { useBottomSheetDrag } from '../hooks/useBottomSheetDrag'
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

  const { expanded, handleProps, sheetStyle } = useBottomSheetDrag({
    defaultMaxHeight: 'calc(85dvh - env(safe-area-inset-top))',
  })

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
        className="fixed inset-0 z-50 bg-night-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center p-0 sm:p-4">
        <div
          className="w-full sm:max-w-sm bg-cream-50 rounded-t-3xl sm:rounded-3xl sm:border-2 sm:border-night-900 shadow-elevated overflow-hidden animate-slide-up flex flex-col"
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
            <div className={`w-10 h-1 rounded-full transition-colors duration-200 ${expanded ? 'bg-night-900/40' : 'bg-night-900/25'}`} />
          </div>

          <div
            className="px-5 sm:px-6 pt-3 pb-5 overflow-y-auto overscroll-contain flex-1"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display uppercase tracking-wide text-xl text-night-900">Notifications</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-charcoal-500 hover:bg-cream-100 hover:text-night-800 transition-colors text-2xl leading-none"
                aria-label="Close"
              >×</button>
            </div>

            {/* Push notification toggle */}
            <div className="mb-6">
              <div className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-night-800">Push notifications</p>
                  <p className="text-xs text-charcoal-500 mt-0.5">
                    {pushSubscribed
                      ? 'Receiving push on this device'
                      : 'Get alerts even when the app is closed'}
                  </p>
                </div>
                <button
                  onClick={handleTogglePush}
                  disabled={saving || !pushSupported}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    pushSubscribed ? 'bg-sauce-400' : 'bg-night-900/20'
                  } ${!pushSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                  aria-label={pushSubscribed ? 'Disable push' : 'Enable push'}
                  role="switch"
                  aria-checked={pushSubscribed}
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
                <p className="text-xs text-sauce-700 bg-sauce-50 border border-sauce-200 rounded-xl px-3 py-2 mt-1">
                  Push notifications are not supported in this browser.
                </p>
              )}

              {pushSupported && needsHomeScreenInstall() && (
                <div className="text-xs text-sauce-700 bg-sauce-50 border border-sauce-200 rounded-xl px-3 py-2 mt-1">
                  <p className="font-bold">Add to Home Screen required</p>
                  <p className="mt-1">
                    On iPhone, push notifications only work when the app is added to your Home
                    Screen. Tap the Share button in Safari, then "Add to Home Screen."
                  </p>
                </div>
              )}

              {permState === 'denied' && (
                <p className="text-xs text-sauce-700 bg-sauce-50 border border-sauce-200 rounded-xl px-3 py-2 mt-1">
                  Notifications are blocked in your browser settings. You'll need to
                  allow notifications for this site in your browser or device settings.
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-night-900/10 mb-4" />

            {/* Preference toggles */}
            <div className="space-y-0.5">
              <p className="eyebrow text-night-700 mb-3">
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

                <ToggleRow
                  label="List likes"
                  description="When someone likes a list you made"
                  checked={prefs?.crawl_like ?? true}
                  onChange={(v) => handleTogglePref('crawl_like', v)}
                />

                <ToggleRow
                  label="New lists from people you follow"
                  description="When someone you follow publishes a list"
                  checked={prefs?.new_crawl_from_followed_user ?? true}
                  onChange={(v) => handleTogglePref('new_crawl_from_followed_user', v)}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-night-900/10 my-3" />

              <ToggleRow
                label="Quiet mode"
                description="Record notifications in-app but suppress push alerts"
                checked={prefs?.quiet_mode ?? false}
                onChange={(v) => handleTogglePref('quiet_mode', v)}
              />
            </div>

            {/* iOS-specific info */}
            {isIOS() && (
              <div className="mt-5 text-xs text-charcoal-500 bg-cream-100 border border-night-900/10 rounded-xl px-3 py-2.5 leading-relaxed">
                <p className="font-bold text-night-700 mb-1">iPhone tips</p>
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
    <div className="flex items-center justify-between gap-3 py-2.5 min-h-[52px]">
      <div className="min-w-0 pr-1">
        <p className="text-sm font-medium text-night-800">{label}</p>
        <p className="text-xs text-charcoal-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
          checked ? 'bg-sauce-400' : 'bg-night-900/20'
        }`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
