import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { MAX_IMAGE_MB, validateImageFile } from '../../lib/imageValidation'

interface Props {
  files: File[]
  onChange: (files: File[]) => void
  max?: number   // max total files allowed (default 5)
}

export default function PhotoUpload({ files, onChange, max = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [checking, setChecking] = useState(false)
  // Validation decodes each image (async), so read the latest list from a
  // ref when merging — a second pick during the check must not drop the first.
  const filesRef = useRef(files)
  filesRef.current = files

  const addFiles = async (incoming: FileList | File[]) => {
    const list = Array.from(incoming)
    if (!list.length) return
    setChecking(true)
    const results = await Promise.all(list.map(f => validateImageFile(f)))
    setChecking(false)
    const valid: File[] = []
    const errors: string[] = []
    list.forEach((f, i) => {
      const err = results[i]
      if (err) errors.push(err)
      else valid.push(f)
    })
    if (errors.length) toast.error(errors.join(' '), { duration: 6000 })
    if (!valid.length) return
    const current = filesRef.current
    const merged = [...current, ...valid].slice(0, max)
    if (merged.length < current.length + valid.length) {
      toast.error(`You can add up to ${max} photos.`)
    }
    onChange(merged)
  }

  const remove = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    return () => { urls.forEach(URL.revokeObjectURL) }
  }, [files])

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          void addFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 min-h-[120px] cursor-pointer transition-colors ${
          dragging
            ? 'border-sauce-400 bg-sauce-50'
            : 'border-night-900/25 bg-cream-100 hover:border-sauce-300 hover:bg-sauce-50/40'
        }`}
      >
        <span className="text-2xl">📷</span>
        <p className="text-sm font-bold text-night-800">
          {checking ? 'Checking photos…' : dragging ? 'Drop to add' : 'Add photos'}
        </p>
        <p className="text-xs text-charcoal-500">
          Tap to choose, or drag photos here · up to {max} photos · {MAX_IMAGE_MB} MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={e => {
            if (e.target.files) void addFiles(e.target.files)
            // Reset so picking the same file again (after removing it) fires onChange
            e.target.value = ''
          }}
        />
      </div>

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((_, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-cream-100 border border-night-900/15">
              <img
                src={previews[i]}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); remove(i) }}
                className="absolute top-0 right-0 w-11 h-11 flex items-center justify-center"
                aria-label="Remove photo"
              >
                <span className="w-7 h-7 rounded-full bg-night-900/75 hover:bg-night-900 text-cream-50 text-base flex items-center justify-center shadow-sm transition-colors">
                  ×
                </span>
              </button>
            </div>
          ))}
          {files.length < max && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-night-900/25 hover:border-sauce-400 flex items-center justify-center text-charcoal-400 hover:text-sauce-500 transition-colors text-2xl"
              aria-label="Add another photo"
            >
              +
            </button>
          )}
        </div>
      )}
    </div>
  )
}
