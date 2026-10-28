import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import CommentSection from './CommentSection'
import { replyPlaceholder } from './CommentComposer'
import type { Comment, AddCommentOptions } from '../../lib/types'

vi.mock('../../lib/reactionDetails', () => ({
  fetchReviewCommentLikers: vi.fn(async () => []),
  fetchReviewCommentReactors: vi.fn(async () => []),
}))
vi.mock('./GifPicker', () => ({ default: () => null }))

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    user_id: 'u2',
    text: 'Great wings',
    created_at: new Date().toISOString(),
    parent_comment_id: null,
    content_type: 'text',
    media_url: null,
    commenter_name: 'Ann',
    commenter_avatar: null,
    commenter_email: null,
    like_count: 0,
    is_liked_by_me: false,
    reply_count: 0,
    reactions: [],
    ...overrides,
  }
}

const noop = async () => {}

describe('Comment composer', () => {
  it('does not silently cut pasted text: shows a counter and blocks Post over 500', () => {
    render(
      <CommentSection comments={[]} loading={false} currentUserId="u1" isAdmin={false}
        onAdd={noop} onDelete={noop} onToggleLike={noop} onToggleReaction={noop} onFetchReplies={async () => []} />
    )
    const box = screen.getByRole('textbox', { name: 'Add a comment' })
    expect(box).not.toHaveAttribute('maxlength')

    fireEvent.change(box, { target: { value: 'a'.repeat(450) } })
    expect(screen.getByText('450/500 characters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled()

    fireEvent.change(box, { target: { value: 'a'.repeat(620) } })
    expect((box as HTMLTextAreaElement).value).toHaveLength(620)
    expect(screen.getByText(/Too long: 620\/500 characters\. Remove 120 to post\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled()
  })

  it('keeps the reply placeholder on one short line', () => {
    expect(replyPlaceholder('Ann')).toBe('Reply to Ann…')
    expect(replyPlaceholder('A very very long display name here')).toBe('Reply to A very very long di…')
  })
})

describe('Comment threads', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  /** Stateful harness: behaves like useReviewComments for replies. */
  function Harness({ initial, focus }: { initial: Comment[]; focus?: { id: string; parentId: string | null } }) {
    const [comments, setComments] = useState(initial)
    const fetchReplies = async (parentId: string) => {
      const replies = [makeComment({ id: 'r1', parent_comment_id: parentId, text: 'First reply', commenter_name: 'Bob' })]
      setComments(prev => prev.map(c => (c.id === parentId ? { ...c, replies, reply_count: replies.length } : c)))
      return replies
    }
    const onAdd = async (opts: string | AddCommentOptions) => {
      const o = typeof opts === 'string' ? { text: opts } : opts
      if (!o.parentCommentId) return
      const mine = makeComment({ id: 'r-mine', user_id: 'u1', parent_comment_id: o.parentCommentId, text: o.text ?? '', commenter_name: 'Me' })
      setComments(prev => prev.map(c => (c.id === o.parentCommentId
        ? { ...c, replies: [...(c.replies ?? []), mine], reply_count: c.reply_count + 1 }
        : c)))
    }
    return (
      <CommentSection comments={comments} loading={false} currentUserId="u1" isAdmin={false}
        onAdd={onAdd} onDelete={noop} onToggleLike={noop} onToggleReaction={noop} onFetchReplies={fetchReplies}
        focusCommentId={focus?.id ?? null} focusParentId={focus?.parentId ?? null} focusKey="k1" />
    )
  }

  it('keeps the thread open after you post a reply, so the reply is visible', async () => {
    render(<Harness initial={[makeComment()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Agreed' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post' })) })
    expect(screen.getByText('Agreed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide replies' })).toBeInTheDocument()
  })

  it('deep link to a reply: opens its thread, scrolls to it and highlights it', async () => {
    render(<Harness initial={[makeComment({ reply_count: 1 })]} focus={{ id: 'r1', parentId: 'c1' }} />)
    await waitFor(() => expect(screen.getByText('First reply')).toBeInTheDocument())
    const el = document.getElementById('comment-r1')!
    await waitFor(() => expect(el.scrollIntoView).toHaveBeenCalled())
    expect(el.className).toContain('bg-gold-100')
  })

  it('gives comment controls 44px hit areas', () => {
    render(<Harness initial={[makeComment({ user_id: 'u1' })]} />)
    expect(screen.getByRole('button', { name: 'Reply' })).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('button', { name: 'Like comment' })).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    expect(screen.getByRole('button', { name: 'Comment options' })).toHaveClass('w-11', 'h-11')
    expect(screen.getByRole('button', { name: 'Add reaction' })).toHaveClass('w-11', 'h-11')
  })

  it('isolates right-to-left override characters in comments', () => {
    render(<Harness initial={[makeComment({ text: '‮evil' })]} />)
    const p = screen.getByText('evil')
    expect(p).toHaveClass('user-text')
  })
})

describe('Comment header time', () => {
  it('shows a compact time that cannot be cut off, with the full date as its name', () => {
    const created = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    render(
      <CommentSection comments={[makeComment({ created_at: created, commenter_name: 'A really really long display name' })]}
        loading={false} currentUserId="u1" isAdmin={false}
        onAdd={noop} onDelete={noop} onToggleLike={noop} onToggleReaction={noop} onFetchReplies={async () => []} />
    )
    const time = screen.getByText('5m')
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('dateTime', created)
    expect(time.getAttribute('aria-label')).toMatch(/^\w+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M$/)
    expect(time.className).toContain('flex-shrink-0')
    expect(time.className).not.toContain('truncate')
  })
})
