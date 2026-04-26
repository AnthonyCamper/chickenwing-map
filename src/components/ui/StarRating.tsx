interface BaseProps {
  /** 0–max, supports decimals — fractional stars render proportionally. */
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
}

interface ReadonlyProps extends BaseProps {
  interactive?: false
}

interface InteractiveProps extends BaseProps {
  interactive: true
  /** Click on a star snaps to its integer value. For decimal entry use RatingPicker. */
  onChange: (val: number) => void
}

type Props = ReadonlyProps | InteractiveProps

const SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

export default function StarRating(props: Props) {
  const { value, max = 10, size = 'md' } = props
  const interactive = 'interactive' in props && props.interactive

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${SIZES[size]} leading-none align-middle`}
      role="img"
      aria-label={`${value.toFixed(1)} out of ${max} stars`}
    >
      {Array.from({ length: max }, (_, i) => {
        // Star i represents value range [i, i+1] — fill is the fractional remainder.
        const fill = Math.max(0, Math.min(1, value - i))

        if (interactive && 'onChange' in props) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => props.onChange(i + 1)}
              className="transition-transform active:scale-90 focus:outline-none"
              aria-label={`${i + 1} star`}
            >
              <Star fill={fill} />
            </button>
          )
        }

        return <Star key={i} fill={fill} />
      })}
    </span>
  )
}

function Star({ fill }: { fill: number }) {
  // Optimization: skip the overlay when fully empty or fully full.
  if (fill <= 0) return <span className="text-warmgray-300">★</span>
  if (fill >= 1) return <span className="text-amber-400">★</span>
  return (
    <span className="relative inline-block leading-none">
      <span className="text-warmgray-300">★</span>
      <span
        className="absolute inset-0 overflow-hidden text-amber-400"
        style={{ width: `${fill * 100}%` }}
        aria-hidden
      >
        ★
      </span>
    </span>
  )
}
