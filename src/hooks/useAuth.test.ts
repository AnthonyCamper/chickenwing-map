import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const calls: string[] = []
  const files: Record<string, Record<string, { id: string | null; name: string }[]>> = {
    'review-photos': {
      u1: [{ id: null, name: 'rev1' }],
      'u1/rev1': [{ id: 'f1', name: 'a.jpg' }, { id: 'f2', name: 'b.jpg' }],
    },
    'user-avatars': { u1: [{ id: 'f3', name: 'avatar.jpg' }] },
    'crawl-covers': {},
  }
  return {
    calls,
    files,
    removed: [] as string[][],
    rpc: vi.fn(),
    signOut: vi.fn(),
    signInWithPassword: vi.fn(),
    updateUser: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        list: async (prefix: string) => {
          mocks.calls.push(`list ${bucket}/${prefix}`)
          return { data: mocks.files[bucket]?.[prefix] ?? [], error: null }
        },
        remove: async (paths: string[]) => {
          mocks.calls.push(`remove ${bucket}`)
          mocks.removed.push(paths)
          return { data: [], error: null }
        },
      }),
    },
    rpc: (...args: unknown[]) => { mocks.calls.push('rpc'); return mocks.rpc(...args) },
    auth: {
      signOut: (...args: unknown[]) => { mocks.calls.push('signOut'); return mocks.signOut(...args) },
      signInWithPassword: mocks.signInWithPassword,
      updateUser: mocks.updateUser,
    },
  },
}))

import { changePassword, deleteOwnAccount, hasPasswordLogin } from './useAuth'

beforeEach(() => {
  mocks.calls.length = 0
  mocks.removed.length = 0
  vi.clearAllMocks()
})

describe('deleteOwnAccount', () => {
  it('removes the user\'s files (one folder level deep), then calls the RPC, then signs out locally', async () => {
    mocks.rpc.mockResolvedValue({ error: null })
    const res = await deleteOwnAccount('u1')
    expect(res.error).toBeNull()
    expect(mocks.removed).toContainEqual(['u1/rev1/a.jpg', 'u1/rev1/b.jpg'])
    expect(mocks.removed).toContainEqual(['u1/avatar.jpg'])
    expect(mocks.rpc).toHaveBeenCalledWith('delete_own_account')
    expect(mocks.calls.indexOf('rpc')).toBeGreaterThan(mocks.calls.lastIndexOf('remove user-avatars'))
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('reports an RPC failure and stays signed in', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Admin accounts can\'t be deleted here.' } })
    const res = await deleteOwnAccount('u1')
    expect(res.error).toMatch(/admin/i)
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
})

describe('changePassword', () => {
  it('refuses when the current password is wrong', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const res = await changePassword('a@b.co', 'wrong', 'newpassword')
    expect(res.error).toMatch(/current password is not correct/i)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('updates the password once the current one checks out', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null })
    mocks.updateUser.mockResolvedValue({ error: null })
    expect((await changePassword('a@b.co', 'right', 'newpassword')).error).toBeNull()
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'newpassword' })
  })
})

describe('hasPasswordLogin', () => {
  it('is true only for accounts with the email provider', () => {
    const u = (providers: string[]) => ({ app_metadata: { providers } }) as never
    expect(hasPasswordLogin(u(['email']))).toBe(true)
    expect(hasPasswordLogin(u(['google', 'email']))).toBe(true)
    expect(hasPasswordLogin(u(['google']))).toBe(false)
    expect(hasPasswordLogin(null)).toBe(false)
  })
})
