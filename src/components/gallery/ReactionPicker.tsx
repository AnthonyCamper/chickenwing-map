import type { CommentReaction } from '../../lib/types'

const REACTIONS = ['👍', '❤️', '😂', '🔥'] as const
type ReactionType = typeof REACTIONS[number]

interface Props {
  reactions: CommentReaction[]
  onToggle: (type: string) => void
  disabled?: boolean
}

export default function ReactionPicker({ reactions, onToggle, disabled }: Props) {
  const byType = Object.fromEntries(reactions.map(r => [r.reaction_type, r]))

  const hasAny = reactions.some(r => r.count > 0)
  if (!hasAny && disabled) return null

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {REACTIONS.map(emoji => {
        const r = byType[emoji]
        const count = r?.count ?? 0
        const mine = r?.is_mine ?? false
        if (count === 0 && disabled) return null

        return (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(emoji)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${
              mine
                ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                : count > 0
                  ? 'bg-warmgray-100 text-charcoal-600 hover:bg-warmgray-200'
                  : 'bg-warmgray-50 text-charcoal-400 hover:bg-warmgray-100'
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            <span>{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export { REACTIONS }
export type { ReactionType }
