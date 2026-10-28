import { useState } from 'react'
import { cleanUserText } from '../../lib/userText'

/** Character limit before truncation kicks in. */
const TRUNCATE_AT = 280

interface Props {
  text: string
  /** Threshold in characters. Defaults to 280. */
  limit?: number
  className?: string
}

export default function ExpandableText({ text: rawText, limit = TRUNCATE_AT, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false)
  // Someone else's words: strip bidi overrides / Zalgo before showing them
  const text = cleanUserText(rawText)
  const needsTruncation = text.length > limit

  return (
    <div className={className}>
      <p
        className="text-sm text-charcoal-600 leading-relaxed italic whitespace-pre-line break-words user-text"
        style={{ overflowWrap: 'anywhere' }}
      >
        &ldquo;{needsTruncation && !expanded ? `${text.slice(0, limit).trimEnd()}…` : text}&rdquo;
      </p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="min-h-[44px] -my-2.5 text-xs text-amber-400 hover:text-amber-500 font-medium transition-colors"
        >
          {expanded ? 'Show less' : 'Read more…'}
        </button>
      )}
    </div>
  )
}
