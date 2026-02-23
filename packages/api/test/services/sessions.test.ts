import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '../../src/db/index.js'
import {
	createSession,
	revokeAllUserSessions,
	revokeSession,
	verifySession,
} from '../../src/services/sessions.js'
import { createTestUser, resetDb } from '../helpers.js'

beforeEach(() => resetDb())

describe('createSession', () => {
	it('returns a JWT string', async () => {
		createTestUser('u1', 'alice')
		const token = await createSession('u1')
		expect(typeof token).toBe('string')
		expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
	})

	it('creates a DB entry', async () => {
		createTestUser('u1', 'alice')
		await createSession('u1')
		const db = getDb()
		const row = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE user_id = ?').get('u1') as {
			c: number
		}
		expect(row.c).toBe(1)
	})
})

describe('verifySession', () => {
	it('returns payload for valid token', async () => {
		createTestUser('u1', 'alice')
		const token = await createSession('u1')
		const payload = await verifySession(token)
		expect(payload).not.toBeNull()
		expect(payload!.sub).toBe('u1')
		expect(payload!.jti).toBeDefined()
	})

	it('returns null for garbage token', async () => {
		const payload = await verifySession('not-a-jwt')
		expect(payload).toBeNull()
	})

	it('returns null after session is revoked', async () => {
		createTestUser('u1', 'alice')
		const token = await createSession('u1')
		const payload = await verifySession(token)
		expect(payload).not.toBeNull()
		revokeSession(payload!.jti)
		expect(await verifySession(token)).toBeNull()
	})

	it('updates last_active_at on verify', async () => {
		createTestUser('u1', 'alice')
		const token = await createSession('u1')
		const payload = await verifySession(token)
		const db = getDb()
		const row = db
			.prepare('SELECT last_active_at FROM sessions WHERE jti = ?')
			.get(payload!.jti) as { last_active_at: string }
		expect(row.last_active_at).toBeDefined()
	})
})

describe('revokeAllUserSessions', () => {
	it('removes all sessions for a user', async () => {
		createTestUser('u1', 'alice')
		await createSession('u1')
		await createSession('u1')
		await createSession('u1')

		const db = getDb()
		const before = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE user_id = ?').get('u1') as {
			c: number
		}
		expect(before.c).toBe(3)

		revokeAllUserSessions('u1')

		const after = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE user_id = ?').get('u1') as {
			c: number
		}
		expect(after.c).toBe(0)
	})
})
