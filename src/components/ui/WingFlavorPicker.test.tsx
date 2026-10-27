import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WingFlavorPicker from './WingFlavorPicker'

describe('WingFlavorPicker', () => {
  it('has no inner scroll box; shows a short list with a "Show all" toggle', () => {
    const { container } = render(<WingFlavorPicker value="" onChange={vi.fn()} />)
    expect(container.querySelector('.overflow-y-auto')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Plain/Naked' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Show all \d+ flavors/ }))
    expect(screen.getByRole('button', { name: 'Plain/Naked' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show fewer flavors' })).toBeInTheDocument()
  })

  it('search still finds flavors outside the short list', () => {
    render(<WingFlavorPicker value="" onChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Search flavors'), { target: { value: 'naked' } })
    expect(screen.getByRole('button', { name: 'Plain/Naked' })).toBeInTheDocument()
  })
})
