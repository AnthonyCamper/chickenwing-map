import { useRef, useState } from 'react'

const MAX_MB = 5

interface Props {
  files: File[]
  onChange: (files: File[]) => void
  max?: number   // max total files allowed (default 5)
}

function validateFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return `${file.name} is not an image.`
  if (file.size > MAX_MB * 1024 * 1024) return `${file.name} exceeds ${MAX_MB}MB.`
  return null
}

export default function PhotoUpload({ files, onChange, max = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const addFiles = (incoming: FileList | File[]) => {
    const valid: File[] = []
    const errors: string[] = []
    for (const f of Array.from(incoming)) {
      const err = validateFile(f)
      if (err) { errors.push(err); continue }
      valid.push(f)
    }
    if (errors.length) alert(errors.join('\n'))
    const merged = [...files, ...valid].slice(0, max)
    onChange(merged)
  }

  const remove = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  const previews = files.map(f => URL.createObjectURL(f))

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
          dragging
            ? 'border-amber-400 bg-amber-50'
            : 'border-warmgray-300 bg-warmgray-50 hover:border-amber-300 hover:bg-amber-50/40'
        }`}
      >
        <span className="text-2xl">📷</span>
        <p className="text-sm font-medium text-charcoal-600">
          {dragging ? 'Drop to add' : 'Add photos'}
        </p>
        <p className="text-xs text-charcoal-300">
          Drag & drop or tap · up to {max} photos · {MAX_MB}MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((_, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-warmgray-100 group">
              <img
                src={previews[i]}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); remove(i) }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
          {files.length < max && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-warmgray-300 hover:border-amber-300 flex items-center justify-center text-charcoal-300 hover:text-amber-400 transition-colors text-2xl"
            >
              +
            </button>
          )}
        </div>
      )}
    </div>
  )
}
