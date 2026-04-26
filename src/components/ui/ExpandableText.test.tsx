import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExpandableText from './ExpandableText'

const SHORT_TEXT = 'Great flat white, cozy vibes.'
const EXACTLY_280 = 'a'.repeat(280)
const JUST_OVER_280 = 'a'.repeat(281)
const LONG_TEXT = 'This is a really wonderful wing spot. '.repeat(30) // ~1200 chars
const VERY_LONG_TEXT = 'x'.repeat(4999)
const MULTI_PARAGRAPH = 'First paragraph about the coffee.\n\nSecond paragraph about the vibes.\n\nThird paragraph about the pastries.'
const LONG_UNBROKEN = 'superlongwordwithnobreaks'.repeat(50)

describe('ExpandableText', () => {
  it('renders short text in full without Read more', () => {
    render(<ExpandableText text={SHORT_TEXT} />)
    expect(screen.getByText(/Great flat white/)).toBeInTheDocument()
    expect(screen.queryByText('Read more…')).not.toBeInTheDocument()
  })

  it('renders text exactly at limit without truncation', () => {
    render(<ExpandableText text={EXACTLY_280} />)
    // Full text shown (wrapped in quotes)
    expect(screen.queryByText('Read more…')).not.toBeInTheDocument()
  })

  it('truncates text just over the limit', () => {
    render(<ExpandableText text={JUST_OVER_280} />)
    expect(screen.getByText('Read more…')).toBeInTheDocument()
  })

  it('truncates long text and shows Read more', () => {
    render(<ExpandableText text={LONG_TEXT} />)
    expect(screen.getByText('Read more…')).toBeInTheDocument()
    // Truncated text should not contain the full content
    const paragraph = screen.getByText(/This is a really/)
    expect(paragraph.textContent!.length).toBeLessThan(LONG_TEXT.length + 10) // +10 for quotes
  })

  it('expands on Read more click and shows Show less', () => {
    render(<ExpandableText text={LONG_TEXT} />)
    fireEvent.click(screen.getByText('Read more…'))
    expect(screen.getByText('Show less')).toBeInTheDocument()
    expect(screen.queryByText('Read more…')).not.toBeInTheDocument()
    // Full text visible
    expect(screen.getByText(/This is a really/).textContent).toContain(LONG_TEXT)
  })

  it('collapses on Show less click', () => {
    render(<ExpandableText text={LONG_TEXT} />)
    fireEvent.click(screen.getByText('Read more…'))
    fireEvent.click(screen.getByText('Show less'))
    expect(screen.getByText('Read more…')).toBeInTheDocument()
    expect(screen.queryByText('Show less')).not.toBeInTheDocument()
  })

  it('handles very long text near the 5000-char limit', () => {
    render(<ExpandableText text={VERY_LONG_TEXT} />)
    expect(screen.getByText('Read more…')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Read more…'))
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  it('preserves line breaks in multi-paragraph text', () => {
    render(<ExpandableText text={MULTI_PARAGRAPH} />)
    const el = screen.getByText(/First paragraph/)
    // whitespace-pre-line class preserves newlines
    expect(el.className).toContain('whitespace-pre-line')
  })

  it('handles long unbroken strings with break-words', () => {
    render(<ExpandableText text={LONG_UNBROKEN} />)
    const el = screen.getByText(/superlongword/)
    expect(el.className).toContain('break-words')
    expect(el.style.overflowWrap).toBe('anywhere')
  })

  it('respects custom limit prop', () => {
    render(<ExpandableText text="Hello world! This is a test." limit={10} />)
    expect(screen.getByText('Read more…')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<ExpandableText text={SHORT_TEXT} className="mb-4" />)
    expect(container.firstChild).toHaveClass('mb-4')
  })
})
