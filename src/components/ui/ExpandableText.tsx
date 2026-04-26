import { useState } from 'react'

/** Character limit before truncation kicks in. */
const TRUNCATE_AT = 280

interface Props {
  text: string
  /** Threshold in characters. Defaults to 280. */
  limit?: number
  className?: string
}

export default function ExpandableText({ text, limit = TRUNCATE_AT, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = text.length > limit

  return (
    <div className={className}>
      <p
        className="text-sm text-charcoal-600 leading-relaxed italic whitespace-pre-line break-words"
        style={{ overflowWrap: 'anywhere' }}
      >
        &ldquo;{needsTruncation && !expanded ? `${text.slice(0, limit).trimEnd()}…` : text}&rdquo;
      </p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-amber-400 hover:text-amber-500 font-medium mt-1 transition-colors"
        >
          {expanded ? 'Show less' : 'Read more…'}
        </button>
      )}
    </div>
  )
}
