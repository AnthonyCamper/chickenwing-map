import { describe, it, expect } from 'vitest'
import { cleanUserText } from './userText'

describe('cleanUserText', () => {
  it('returns empty string for null/undefined', () => {
    expect(cleanUserText(null)).toBe('')
    expect(cleanUserText(undefined)).toBe('')
  })

  it('strips bidi override and isolate controls', () => {
    expect(cleanUserText('abc‮def‬')).toBe('abcdef')
    expect(cleanUserText('⁧x⁩')).toBe('x')
  })

  it('keeps real right-to-left text and emoji', () => {
    expect(cleanUserText('Breaker 🍗 مرحبا')).toBe('Breaker 🍗 مرحبا')
  })

  it('caps runs of combining marks at two', () => {
    const zalgo = 'Z' + '̷̸̵̶̴'.repeat(20) + 'a'
    expect(cleanUserText(zalgo)).toBe('Z̷̸a')
  })

  it('leaves normal accented text alone', () => {
    expect(cleanUserText('Crème brûlée, Phở')).toBe('Crème brûlée, Phở')
    expect(cleanUserText('Phở'.normalize('NFD'))).toBe('Phở'.normalize('NFD'))
  })
})
