import { useState, useRef, useEffect } from 'react'
import type { UseNotificationsReturn } from '../hooks/useNotifications'
import NotificationCenter from './NotificationCenter'

interface Props {
  notifications: UseNotificationsReturn
}

export default function NotificationBell({ notifications }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click or touch
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  return (
    <div className="relative flex-shrink-0" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-night-700 active:bg-night-600 transition-colors relative"
        aria-label={`Notifications${notifications.unreadCount > 0 ? ` (${notifications.unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        {/* Bell icon */}
        <svg
          className="w-5 h-5 text-cream-50"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {/* Unread badge */}
        {notifications.unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-sauce-400 text-cream-50 text-[10px] font-extrabold flex items-center justify-center leading-none border border-night-900">
            {notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <NotificationCenter
          notifications={notifications}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
