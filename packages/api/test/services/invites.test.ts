import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '../../src/db/index.js'
import {
	createInvite,
	deleteInvite,
	listInvites,
	markInviteUsed,
	validateInvite,
} from '../../src/services/invites.js'
import { createTestUser, resetDb } from '../helpers.js'

beforeEach(() => resetDb())

describe('createInvite', () => {
	it('creates an invite token', () => {
		createTestUser('admin1', 'admin', 'admin')
		const invite = createInvite('admin1', 'newuser', 72)
		expect(invite.id).toBeDefined()
		expect(invite.created_by).toBe('admin1')
		expect(invite.username).toBe('newuser')
		expect(invite.used_by).toBeNull()
		expect(invite.expires_at).toBeDefined()
	})

	it('defaults to 72 hour expiration', () => {
		createTestUser('admin1', 'admin', 'admin')
		const invite = createInvite('admin1', 'newuser')
		const expiresAt = new Date(invite.expires_at).getTime()
		const expected = Date.now() + 72 * 60 * 60 * 1000
		// Allow 10s tolerance
		expect(Math.abs(expiresAt - expected)).toBeLessThan(10_000)
	})
})

describe('validateInvite', () => {
	it('valid invite passes', () => {
		createTestUser('admin1', 'admin', 'admin')
		const invite = createInvite('admin1', 'newuser')
		const result = validateInvite(invite.id)
		expect(result.valid).toBe(true)
		expect(result.invite).toBeDefined()
	})

	it('non-existent invite fails', () => {
		const result = validateInvite('nonexistent')
		expect(result.valid).toBe(false)
		expect(result.error).toContain('not found')
	})

	it('used invite fails', () => {
		createTestUser('admin1', 'admin', 'admin')
		createTestUser('u2', 'newuser')
		const invite = createInvite('admin1', 'newuser')
		markInviteUsed(invite.id, 'u2')
		const result = validateInvite(invite.id)
		expect(result.valid).toBe(false)
		expect(result.error).toContain('used')
	})

	it('expired invite fails', () => {
		createTestUser('admin1', 'admin', 'admin')
		const db = getDb()
		const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString()
		db.prepare(
			`INSERT INTO invite_tokens (id, created_by, username, expires_at)
       VALUES ('exp1', 'admin1', 'newuser', ?)`,
		).run(pastDate)
		const result = validateInvite('exp1')
		expect(result.valid).toBe(false)
		expect(result.error).toContain('expired')
	})
})

describe('markInviteUsed', () => {
	it('marks invite as used', () => {
		createTestUser('admin1', 'admin', 'admin')
		createTestUser('u2', 'newuser')
		const invite = createInvite('admin1', 'newuser')
		markInviteUsed(invite.id, 'u2')

		const db = getDb()
		const row = db
			.prepare('SELECT used_by, used_at FROM invite_tokens WHERE id = ?')
			.get(invite.id) as { used_by: string; used_at: string }
		expect(row.used_by).toBe('u2')
		expect(row.used_at).toBeDefined()
	})
})

describe('listInvites', () => {
	it('returns all invites', () => {
		createTestUser('admin1', 'admin', 'admin')
		createInvite('admin1', 'user1')
		createInvite('admin1', 'user2')
		const invites = listInvites()
		expect(invites).toHaveLength(2)
	})
})

describe('deleteInvite', () => {
	it('deletes existing invite', () => {
		createTestUser('admin1', 'admin', 'admin')
		const invite = createInvite('admin1', 'user1')
		expect(deleteInvite(invite.id)).toBe(true)
		expect(validateInvite(invite.id).valid).toBe(false)
	})

	it('returns false for non-existent invite', () => {
		expect(deleteInvite('nope')).toBe(false)
	})
})
