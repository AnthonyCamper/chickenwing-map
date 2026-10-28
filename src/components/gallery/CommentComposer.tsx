import { forwardRef, useCallback, useId, useImperativeHandle, useLayoutEffect, useRef } from 'react'

/** Same limit as the review_comments CHECK constraint. */
export const COMMENT_MAX_LENGTH = 500
/** Show the "n/500" counter once the text is this close to the limit. */
const COUNTER_FROM = 400
/** The textarea grows with its text up to this height, then scrolls. */
const MAX_TEXTAREA_PX = 160

/** True when the text is too long to post. */
export function commentTooLong(text: string): boolean {
  return text.length > COMMENT_MAX_LENGTH
}

/** "Reply to <name>…" without letting a long name wrap the placeholder. */
export function replyPlaceholder(name: string | null | undefined): string {
  if (!name) return 'Add a comment…'
  const short = name.length > 20 ? name.slice(0, 19).trimEnd() : name
  return `Reply to ${short}…`
}

interface Props {
  value: string
  onChange: (text: string) => void
  onSubmit: () => void
  posting: boolean
  /** A GIF is attached, so an empty text box can still be posted. */
  hasAttachment?: boolean
  placeholder: string
  gifOpen: boolean
  onToggleGif: () => void
  /** Called on focus; return false to blur (e.g. signed out → sign-in prompt). */
  onFocusGate?: () => boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * Comment box used everywhere comments can be written. Full-width text field
 * that grows with its text; GIF, character counter and Post sit on their own
 * row underneath so the text field never gets squeezed on a phone.
 */
const CommentComposer = forwardRef<HTMLTextAreaElement, Props>(function CommentComposer({
  value,
  onChange,
  onSubmit,
  posting,
  hasAttachment = false,
  placeholder,
  gifOpen,
  onToggleGif,
  onFocusGate,
  className = '',
  style,
}, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)
  const statusId = useId()

  // Grow with the text (1 line → up to MAX_TEXTAREA_PX), shrink after posting.
  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`
  }, [])
  useLayoutEffect(resize, [value, resize])

  const length = value.length
  const tooLong = length > COMMENT_MAX_LENGTH
  const canPost = (!!value.trim() || hasAttachment) && !tooLong && !posting

  return (
    <div className={`border-t border-night-900/10 px-3 pt-2.5 pb-2 bg-cream-50 ${className}`} style={style}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={e => { if (onFocusGate && !onFocusGate()) e.target.blur() }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (canPost) onSubmit()
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, '')}
        aria-describedby={length >= COUNTER_FROM ? statusId : undefined}
        aria-invalid={tooLong || undefined}
        rows={1}
        className={`block w-full resize-none rounded-xl border bg-cream-100 px-3 py-2.5 text-base leading-6 text-night-800 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 transition-colors ${
          tooLong
            ? 'border-sauce-500 focus:ring-sauce-300'
            : 'border-night-900/15 focus:ring-sauce-300 focus:border-night-900/30'
        }`}
        style={{ minHeight: '46px', maxHeight: `${MAX_TEXTAREA_PX}px`, overflowY: 'auto' }}
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleGif}
          aria-pressed={gifOpen}
          className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xs font-extrabold uppercase tracking-crowd transition-colors ${
            gifOpen ? 'bg-sauce-100 text-sauce-600' : 'bg-cream-100 text-charcoal-500 hover:bg-cream-200'
          }`}
          title="Add a GIF"
          aria-label="Add a GIF"
        >
          GIF
        </button>
        <p
          id={statusId}
          aria-live="polite"
          className={`flex-1 min-w-0 text-xs leading-snug ${tooLong ? 'text-sauce-600 font-bold' : 'text-charcoal-500'}`}
        >
          {tooLong
            ? `Too long: ${length}/${COMMENT_MAX_LENGTH} characters. Remove ${length - COMMENT_MAX_LENGTH} to post.`
            : length >= COUNTER_FROM
              ? `${length}/${COMMENT_MAX_LENGTH} characters`
              : ''}
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canPost}
          className="btn-primary px-5 min-h-[44px] text-sm flex-shrink-0 disabled:opacity-40"
        >
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
})

export default CommentComposer
