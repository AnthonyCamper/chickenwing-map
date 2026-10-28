// Display-side cleanup for text other people typed (names, comments, reviews,
// list titles). Rendering stays plain text (React escapes it); this only stops
// Unicode tricks from leaking out of their box.

// Bidi embeddings/overrides/isolates (U+202A–202E, U+2066–2069). A stray
// RIGHT-TO-LEFT OVERRIDE flips everything after it on the line.
const BIDI_CONTROLS = /[‪-‮⁦-⁩]/g

// Runs of combining marks ("Zalgo"). Real scripts need at most a couple per
// letter (e.g. Vietnamese), so anything past MAX_MARKS is dropped.
const MAX_MARKS = 2
const MARK_RUN = /\p{M}+/gu

export function cleanUserText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(BIDI_CONTROLS, '')
    .replace(MARK_RUN, run => (run.length > MAX_MARKS ? Array.from(run).slice(0, MAX_MARKS).join('') : run))
}
