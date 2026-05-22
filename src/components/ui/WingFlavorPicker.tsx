import { useState, useMemo } from 'react'

const FLAVOR_CATEGORIES: Record<string, string[]> = {
  'Buffalo': ['Buffalo Hot', 'Buffalo Medium', 'Buffalo Mild', 'Nashville Hot', 'Ghost Pepper', 'Sriracha', 'Mango Habanero'],
  'BBQ': ['BBQ', 'Honey BBQ', 'Spicy BBQ', 'Carolina Gold BBQ', 'Chipotle BBQ', 'Korean BBQ', 'Bourbon'],
  'Garlic': ['Garlic Parmesan', 'Spicy Garlic', 'Honey Garlic', 'Truffle Parmesan'],
  'Sweet/Citrus': ['Lemon Pepper', 'Thai Chili', 'Sweet Chili', 'Teriyaki', 'Honey Mustard', 'Maple Bacon', 'Peanut Butter Jelly'],
  'Dry Rub': ['Dry Rub', 'Cajun Dry Rub', 'Memphis Dry Rub', 'Ranch Dry Rub', 'Old Bay', 'Honey Old Bay', 'Salt & Vinegar', 'Elote'],
  'Specialty': ['Mumbo Sauce', 'Alabama White Sauce', 'Caribbean Jerk', 'Szechuan', 'Hoisin', 'Smoked', 'Plain/Naked'],
}

const ALL_FLAVORS = Object.values(FLAVOR_CATEGORIES).flat()

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function WingFlavorPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const categories = Object.keys(FLAVOR_CATEGORIES)

  const filtered = useMemo(() => {
    if (!search) return null
    const q = search.toLowerCase()
    return ALL_FLAVORS.filter(f => f.toLowerCase().includes(q))
  }, [search])

  const displayFlavors = filtered ?? (activeCategory ? FLAVOR_CATEGORIES[activeCategory] : ALL_FLAVORS)
  const exactMatch = ALL_FLAVORS.find(f => f.toLowerCase() === search.toLowerCase())
  const showCustomOption = search.trim() && !exactMatch

  function select(flavor: string) {
    onChange(flavor === value ? '' : flavor)
    setSearch('')
  }

  return (
    <div className="space-y-2">
      {value && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-charcoal-900 text-sm font-semibold">
            {value}
            <button
              type="button"
              onClick={() => onChange('')}
              className="leading-none text-charcoal-700 hover:text-charcoal-900 text-base"
              aria-label="Clear flavor"
            >×</button>
          </span>
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          className="input pr-8"
          placeholder="Search flavors or type a custom one…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && search.trim()) {
              e.preventDefault()
              select(exactMatch ?? search.trim())
            }
          }}
        />
        {search && (
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 text-lg leading-none"
            onClick={() => setSearch('')}
            aria-label="Clear search"
          >×</button>
        )}
      </div>

      {!search && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              !activeCategory
                ? 'bg-amber-400 border-amber-400 text-charcoal-900'
                : 'border-warmgray-300 text-charcoal-500 hover:border-amber-300 hover:text-charcoal-700'
            }`}
          >All</button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                activeCategory === cat
                  ? 'bg-amber-400 border-amber-400 text-charcoal-900'
                  : 'border-warmgray-300 text-charcoal-500 hover:border-amber-300 hover:text-charcoal-700'
              }`}
            >{cat}</button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
        {showCustomOption && (
          <button
            type="button"
            onClick={() => select(search.trim())}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors"
          >Use "{search.trim()}"</button>
        )}
        {displayFlavors.map(flavor => (
          <button
            key={flavor}
            type="button"
            onClick={() => select(flavor)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              value === flavor
                ? 'bg-amber-400 border-amber-400 text-charcoal-900'
                : 'bg-warmgray-100 border-warmgray-200 text-charcoal-600 hover:border-amber-300 hover:bg-amber-50'
            }`}
          >{flavor}</button>
        ))}
      </div>
    </div>
  )
}
