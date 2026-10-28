import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReactionPicker from './ReactionPicker'

vi.mock('./EmojiPicker', () => ({ default: () => null }))

describe('ReactionPicker quick tray', () => {
  it('closes on Escape and gives focus back to the React button', () => {
    render(<ReactionPicker reactions={[]} onToggle={vi.fn()} showLabel />)
    const react = screen.getByRole('button', { name: 'React: add a reaction' })
    fireEvent.click(react)
    expect(screen.getByRole('group', { name: 'Choose a reaction' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Choose a reaction' })).not.toBeInTheDocument()
    expect(react).toHaveFocus()
  })

  it('a tap outside closes it without swallowing that tap', () => {
    const onComment = vi.fn()
    render(
      <>
        <button onClick={onComment}>Comment</button>
        <ReactionPicker reactions={[]} onToggle={vi.fn()} showLabel />
      </>
    )
    fireEvent.click(screen.getByRole('button', { name: 'React: add a reaction' }))
    const comment = screen.getByRole('button', { name: 'Comment' })
    fireEvent.pointerDown(comment)
    fireEvent.click(comment)
    expect(onComment).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('group', { name: 'Choose a reaction' })).not.toBeInTheDocument()
  })

  it('opens below the button so it does not cover the row above', () => {
    render(<ReactionPicker reactions={[]} onToggle={vi.fn()} showLabel />)
    const react = screen.getByRole('button', { name: 'React: add a reaction' })
    react.getBoundingClientRect = () => ({ top: 300, bottom: 344, left: 20, right: 120, width: 100, height: 44, x: 20, y: 300, toJSON: () => ({}) })
    fireEvent.click(react)
    const tray = screen.getByRole('group', { name: 'Choose a reaction' })
    expect(parseFloat(tray.style.top)).toBeGreaterThanOrEqual(344)
  })
})
