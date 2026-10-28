import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WingFlavorPicker, { matchFlavor } from './WingFlavorPicker'

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

  it('marks the chosen flavor chip with aria-pressed', () => {
    render(<WingFlavorPicker value="Buffalo Hot" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Buffalo Hot' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Buffalo Mild' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Enter picks the one flavor the search points at instead of the typed text', () => {
    const onChange = vi.fn()
    render(<WingFlavorPicker value="" onChange={onChange} />)
    const search = screen.getByLabelText('Search flavors')
    fireEvent.change(search, { target: { value: 'Buffalo Med' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Buffalo Medium')
  })

  it('Enter keeps custom text when it matches nothing or several flavors', () => {
    expect(matchFlavor('honey')).toBeNull()
    expect(matchFlavor('Mango Lassi')).toBeNull()
    expect(matchFlavor('bbq')).toBe('BBQ')
    expect(matchFlavor('naked')).toBe('Plain/Naked')
  })
})
