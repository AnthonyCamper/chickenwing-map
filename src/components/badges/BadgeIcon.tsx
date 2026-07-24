import type { ComponentType, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

// Sauce accent that reads well on the dark night-800 badge plates.
const ACCENT = '#ff6e60'

function base(props: IconProps): IconProps {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  }
}

/** True North — four-point compass star */
function NorthStar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5 L14.1 9.9 L21.5 12 L14.1 14.1 L12 21.5 L9.9 14.1 L2.5 12 L9.9 9.9 Z" />
      <circle cx="12" cy="12" r="1.4" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** Full Canoe — hull with thwarts over water */
function Canoe(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 11 C8 13.5 16 13.5 22 11" />
      <path d="M2 11 C5 19 19 19 22 11" />
      <circle cx="8" cy="8" r="1.8" fill={ACCENT} stroke="none" />
      <circle cx="16" cy="8" r="1.8" fill={ACCENT} stroke="none" />
      <path d="M5 21.5 H9" />
      <path d="M15 21.5 H19" />
    </svg>
  )
}

/** Puck Drop — falling puck */
function Puck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8.5 2.5 V5.5" stroke={ACCENT} />
      <path d="M12 1.5 V4.5" stroke={ACCENT} />
      <path d="M15.5 2.5 V5.5" stroke={ACCENT} />
      <ellipse cx="12" cy="12.5" rx="7.5" ry="3.2" />
      <path d="M4.5 12.5 V17" />
      <path d="M19.5 12.5 V17" />
      <path d="M4.5 17 A7.5 3.2 0 0 0 19.5 17" />
    </svg>
  )
}

/** The BeaverTail — scored pastry oval */
function Beavertail(props: IconProps) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="12" rx="6.5" ry="9.5" />
      <path d="M8.5 6.5 L15.8 12.5" />
      <path d="M7 11 L14.5 17.5" />
      <path d="M15.5 6.5 L8.2 12.5" />
      <path d="M17 11 L9.5 17.5" />
    </svg>
  )
}

/** Double Double — lidded takeout coffee, two shots marked */
function DoubleDouble(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 8.5 V5.5 H18.5 V8.5 Z" />
      <path d="M6.2 8.5 L8 21 H16 L17.8 8.5" />
      <circle cx="10.3" cy="13.5" r="1.2" fill={ACCENT} stroke="none" />
      <circle cx="13.7" cy="13.5" r="1.2" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** Hat Trick — stick and three pucks */
function HatTrick(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19.5 3 L10.5 16.5 Q9 19.5 5.5 19.5 H3.5" />
      <ellipse cx="5.5" cy="5.5" rx="2.6" ry="1.2" />
      <path d="M2.9 5.5 V7 A2.6 1.2 0 0 0 8.1 7 V5.5" />
      <ellipse cx="12" cy="3.8" rx="2.6" ry="1.2" stroke={ACCENT} />
      <path d="M9.4 3.8 V5.3 A2.6 1.2 0 0 0 14.6 5.3 V3.8" stroke={ACCENT} />
      <ellipse cx="7" cy="11.5" rx="2.6" ry="1.2" />
      <path d="M4.4 11.5 V13 A2.6 1.2 0 0 0 9.6 13 V11.5" />
    </svg>
  )
}

/** The Portage — canoe carried overhead */
function Portage(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 8.5 C5.5 4.5 18.5 4.5 21.5 8.5" />
      <path d="M2.5 8.5 C8 10 16 10 21.5 8.5" />
      <path d="M9.5 9.7 V12.5" />
      <path d="M14.5 9.7 V12.5" />
      <path d="M9.5 12.5 H14.5" />
      <path d="M12 12.5 V14.5" />
      <path d="M12 14.5 L9.5 21.5" />
      <path d="M12 14.5 L14.5 21.5" />
    </svg>
  )
}

/** Question Period — the Peace Tower */
function PeaceTower(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 21.5 H19.5" />
      <path d="M8.5 21.5 V9" />
      <path d="M15.5 21.5 V9" />
      <path d="M7.5 9 L12 3.5 L16.5 9" />
      <path d="M12 3.5 V1.5 H14.5 V2.8 H12" stroke={ACCENT} />
      <circle cx="12" cy="12.5" r="2.2" />
      <path d="M12 12.5 V11.3" strokeWidth="1.2" />
      <path d="M12 12.5 H13" strokeWidth="1.2" />
      <path d="M10.5 21.5 V18.5 Q12 17 13.5 18.5 V21.5" />
    </svg>
  )
}

/** The Hansard — the official record, sealed */
function Hansard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 21.5 V2.5 H14.5 L18.5 6.5 V21.5 Z" />
      <path d="M14.5 2.5 V6.5 H18.5" />
      <path d="M8.5 11 H15.5" />
      <path d="M8.5 14.5 H15.5" />
      <path d="M8.5 18 H12" />
      <circle cx="15" cy="17.8" r="1.5" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** The Full Canal — hockey skate */
function Skate(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 3.5 H10.5 L11.5 9 L16.5 11.5 Q19.5 13 19.5 15.5 V17 H6.5 Z" />
      <path d="M7.8 5.8 L9.7 6.8 M9.7 5.8 L7.8 6.8" strokeWidth="1.2" />
      <path d="M8.5 17 V20" />
      <path d="M16.5 17 V20" />
      <path d="M5 20 H20" stroke={ACCENT} />
    </svg>
  )
}

/** Confederation — shield stamped 1867 */
function Shield1867(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5 L19.5 5 V11.5 C19.5 16.5 16.5 19.8 12 21.5 C7.5 19.8 4.5 16.5 4.5 11.5 V5 Z" />
      <text x="12" y="13.8" textAnchor="middle" fontSize="4.6" fontWeight="800" fill={ACCENT} stroke="none">1867</text>
    </svg>
  )
}

/** Canada Day — firework burst */
function Firework(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5 V6.5" />
      <path d="M12 15.5 V19.5" />
      <path d="M3.5 11 H7.5" />
      <path d="M16.5 11 H20.5" />
      <path d="M5.6 4.6 L8.4 7.4" />
      <path d="M18.4 4.6 L15.6 7.4" />
      <path d="M5.6 17.4 L8.4 14.6" />
      <path d="M18.4 17.4 L15.6 14.6" />
      <circle cx="12" cy="11" r="1.5" fill={ACCENT} stroke="none" />
      <circle cx="18.7" cy="8.3" r="0.9" fill={ACCENT} stroke="none" />
      <circle cx="5.3" cy="13.7" r="0.9" fill={ACCENT} stroke="none" />
      <circle cx="14.8" cy="19.6" r="0.9" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** The Skateway — winding canal with skate marks */
function Skateway(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 2 C13 6.5 1.5 11.5 9 16 C12 17.8 14.5 19.5 15 22" />
      <path d="M11.5 2 C18.5 6.5 7 11.5 14.5 16 C17.5 17.8 20 19.5 20.5 22" />
      <path d="M9.5 4.5 L10.7 6.1" stroke={ACCENT} />
      <path d="M7 10.3 L8.2 11.9" stroke={ACCENT} />
      <path d="M12.8 16.8 L14 18.4" stroke={ACCENT} />
    </svg>
  )
}

/** The Great One — 99 jersey */
function Jersey99(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 3.5 C9 5 10.4 5.6 12 5.6 C13.6 5.6 15 5 16 3.5 L19.5 5.5 L21.5 9 L18.5 10.8 L17.5 9.5 V20.5 H6.5 V9.5 L5.5 10.8 L2.5 9 L4.5 5.5 Z" />
      <text x="12" y="17" textAnchor="middle" fontSize="6.2" fontWeight="800" fill={ACCENT} stroke="none">99</text>
    </svg>
  )
}

/** The Loonie — loon on the dollar */
function LoonCoin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 15 H18.5" />
      <path d="M7.5 15 C7.9 13 9.7 11.8 12 11.8 H13.8 V9.3 C13.8 8.2 14.6 7.3 15.6 7.3 C16.5 7.3 17.2 8 17.2 8.9 V9.5 L19 10 L17.1 10.6 C16.7 12.9 15.5 15 13 15" />
    </svg>
  )
}

/** The Toonie — bimetal two-dollar coin */
function Toonie(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.2" />
      <text x="12" y="14.4" textAnchor="middle" fontSize="6.5" fontWeight="800" fill={ACCENT} stroke="none">2</text>
    </svg>
  )
}

/** Side of Poutine — fries, curds, gravy */
function Poutine(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.3 10 V5" />
      <path d="M12 10 V3.5" />
      <path d="M14.7 10 V5" />
      <path d="M6 10.5 H18" />
      <path d="M6.7 10.5 L8.2 21 H15.8 L17.3 10.5" />
      <circle cx="10.2" cy="14" r="1.1" fill={ACCENT} stroke="none" />
      <circle cx="13.9" cy="15.6" r="1.1" fill={ACCENT} stroke="none" />
      <circle cx="11.6" cy="18.2" r="0.9" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** The Extra U — Canadian spelling */
function LetterU(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4 V12.5 C7 16.8 9 19 12 19 C15 19 17 16.8 17 12.5 V4" strokeWidth="2.2" />
      <circle cx="19.8" cy="4.5" r="1.4" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** National Reflex — the apology bubble */
function SpeechHeart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 4 H18 C19.7 4 21 5.3 21 7 V12.5 C21 14.2 19.7 15.5 18 15.5 H11 L6.5 20 V15.5 H6 C4.3 15.5 3 14.2 3 12.5 V7 C3 5.3 4.3 4 6 4 Z" />
      <path d="M12 12.4 C9.8 10.8 9.2 9.5 10 8.6 C10.6 7.9 11.6 8.2 12 8.9 C12.4 8.2 13.4 7.9 14 8.6 C14.8 9.5 14.2 10.8 12 12.4 Z" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** Tapped — maple leaf */
function SapPail(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5 L13.4 5.8 L16.2 4.2 L15.6 7.6 L19.6 7 L17.4 10.2 L21 11.6 L17.6 13.4 L18.4 15.8 L14.6 15.2 L14 17.6 L12 16 L10 17.6 L9.4 15.2 L5.6 15.8 L6.4 13.4 L3 11.6 L6.6 10.2 L4.4 7 L8.4 7.6 L7.8 4.2 L10.6 5.8 Z" strokeWidth="1.5" />
      <path d="M12 16 V21.5" />
      <circle cx="12" cy="11" r="1.1" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** Rink Rat — the rink itself */
function CrossedSticks(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="4.5" />
      <path d="M12 5 V9.2" />
      <path d="M12 14.8 V19" />
      <circle cx="12" cy="12" r="2.6" stroke={ACCENT} />
      <circle cx="12" cy="12" r="0.9" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** Timmies Run — the donut */
function Donut(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M7.7 8 L9 9" stroke={ACCENT} />
      <path d="M15 6.8 L16 8" stroke={ACCENT} />
      <path d="M17.2 13.5 L15.8 14.3" stroke={ACCENT} />
      <path d="M7 15.5 L8.4 14.9" stroke={ACCENT} />
      <path d="M11.5 17.8 L12.8 17.2" stroke={ACCENT} />
    </svg>
  )
}

/** The Honey Garlic Accord — garlic bulb, honey drop */
function GarlicHoney(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 6.5 C10.5 8 7.5 9.2 7.5 12.8 C7.5 16.2 9.5 18.5 12 18.5 C14.5 18.5 16.5 16.2 16.5 12.8 C16.5 9.2 13.5 8 12 6.5 Z" />
      <path d="M12 6.5 C11.4 5.2 11.4 4 12 2.8" />
      <path d="M10.6 18.2 C10.6 14.5 11.2 11.5 12 9.5" />
      <path d="M13.4 18.2 C13.4 14.5 12.8 11.5 12 9.5" />
      <path d="M19.8 3.5 C18.8 5 18.3 5.9 18.3 6.7 A1.5 1.5 0 0 0 21.3 6.7 C21.3 5.9 20.8 5 19.8 3.5 Z" fill={ACCENT} stroke="none" />
    </svg>
  )
}

/** The Alfie — number 11 in the rafters */
function Banner11(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 3 H19.5" />
      <path d="M6.5 3 V16.5 L12 20.5 L17.5 16.5 V3" />
      <text x="12" y="13" textAnchor="middle" fontSize="6" fontWeight="800" fill={ACCENT} stroke="none">11</text>
    </svg>
  )
}

/** The Two-Four — a full flat */
function TwoFour(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 9.5 H20.5 V20.5 H3.5 Z" />
      <path d="M7 9.5 V7.7" />
      <path d="M12 9.5 V7" />
      <path d="M17 9.5 V7.7" />
      <circle cx="7" cy="6.7" r="1.1" fill={ACCENT} stroke="none" />
      <circle cx="12" cy="6" r="1.1" fill={ACCENT} stroke="none" />
      <circle cx="17" cy="6.7" r="1.1" fill={ACCENT} stroke="none" />
      <text x="12" y="17.4" textAnchor="middle" fontSize="5.2" fontWeight="800" fill={ACCENT} stroke="none">24</text>
    </svg>
  )
}

/** The Snowbirds — nine-jet formation (abridged) */
function Jets(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.9 L13.9 7.1 L12 6 L10.1 7.1 Z" fill={ACCENT} stroke={ACCENT} />
      <path d="M6.5 10.4 L8.4 14.6 L6.5 13.5 L4.6 14.6 Z" />
      <path d="M17.5 10.4 L19.4 14.6 L17.5 13.5 L15.6 14.6 Z" />
      <path d="M12 9 V11.8" />
      <path d="M6.5 16.5 V19.3" />
      <path d="M17.5 16.5 V19.3" />
    </svg>
  )
}

/** Snow Day — snowflake */
function Snowflake(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5 V21.5" />
      <path d="M3.8 7.25 L20.2 16.75" />
      <path d="M20.2 7.25 L3.8 16.75" />
      <path d="M12 5.2 L10.2 4" />
      <path d="M12 5.2 L13.8 4" />
      <path d="M12 18.8 L10.2 20" />
      <path d="M12 18.8 L13.8 20" />
      <circle cx="12" cy="12" r="1.3" fill={ACCENT} stroke="none" />
    </svg>
  )
}

const REGISTRY: Record<string, ComponentType<IconProps>> = {
  'north-star': NorthStar,
  'canoe': Canoe,
  'puck': Puck,
  'beavertail': Beavertail,
  'double-double': DoubleDouble,
  'hat-trick': HatTrick,
  'portage': Portage,
  'peace-tower': PeaceTower,
  'hansard': Hansard,
  'skate': Skate,
  'shield-1867': Shield1867,
  'firework': Firework,
  'skateway': Skateway,
  'jersey-99': Jersey99,
  'loon-coin': LoonCoin,
  'toonie': Toonie,
  'poutine': Poutine,
  'letter-u': LetterU,
  'speech-heart': SpeechHeart,
  'sap-pail': SapPail,
  'crossed-sticks': CrossedSticks,
  'donut': Donut,
  'garlic-honey': GarlicHoney,
  'banner-11': Banner11,
  'two-four': TwoFour,
  'jets': Jets,
  'snowflake': Snowflake,
}

interface Props {
  /** Either a registry key (renders a custom SVG) or an emoji string. */
  icon: string
  className?: string
}

/**
 * Renders a badge icon. Custom-drawn SVG when `icon` matches a registry key,
 * otherwise falls back to the raw string so legacy emoji badges still work.
 */
export default function BadgeIcon({ icon, className }: Props) {
  const Svg = REGISTRY[icon]
  if (!Svg) return <span className={className}>{icon}</span>
  return <Svg className={className} data-testid={`badge-icon-${icon}`} />
}
