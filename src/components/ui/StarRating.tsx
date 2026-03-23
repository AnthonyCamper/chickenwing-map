interface Props {
  value: number          // 0–10, supports decimals for display
  max?: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: false
}

interface InteractiveProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  interactive: true
  onChange: (val: number) => void
}

export default function StarRating(props: Props | InteractiveProps) {
  const { value, max = 10, size = 'md' } = props
  const interactive = 'interactive' in props && props.interactive

  // Slightly tighter sizing so 10 stars remain compact on small screens
  const sizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div className={`flex items-center gap-0.5 ${sizes[size]}`} role="img" aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i + 1 <= value
        const half = !filled && i + 0.5 < value

        if (interactive && 'onChange' in props) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => props.onChange(i + 1)}
              className="transition-transform active:scale-90 focus:outline-none"
              aria-label={`${i + 1} star`}
            >
              <Star filled={filled} half={half} />
            </button>
          )
        }

        return <Star key={i} filled={filled} half={half} />
      })}
    </div>
  )
}

function Star({ filled, half }: { filled: boolean; half: boolean }) {
  if (filled) return <span className="text-amber-400">★</span>
  if (half) return <span className="text-amber-300">★</span>
  return <span className="text-warmgray-300">★</span>
}
