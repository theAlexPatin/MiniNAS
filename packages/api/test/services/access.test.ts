import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '../../src/db/index.js'
import {
	canAccessVolume,
	deleteUser,
	getAccessibleVolumeIds,
	getUserById,
	getVolumeAccessList,
	grantVolumeAccess,
	isAdmin,
	listUsers,
	resetPasskeys,
	revokeVolumeAccess,
	setVolumeVisibility,
} from '../../src/services/access.js'
import { createTestCredential, createTestUser, createTestVolume, resetDb } from '../helpers.js'

beforeEach(() => resetDb())

describe('getUserById', () => {
	it('returns null for non-existent user', () => {
		expect(getUserById('nope')).toBeNull()
	})

	it('returns user info', () => {
		createTestUser('u1', 'alice', 'admin')
		const user = getUserById('u1')
		expect(user).toMatchObject({
			id: 'u1',
			username: 'alice',
			role: 'admin',
		})
		expect(user!.created_at).toBeDefined()
	})
})

describe('isAdmin', () => {
	it('returns true for admin', () => {
		createTestUser('u1', 'admin', 'admin')
		expect(isAdmin('u1')).toBe(true)
	})

	it('returns false for regular user', () => {
		createTestUser('u1', 'alice')
		expect(isAdmin('u1')).toBe(false)
	})

	it('returns false for non-existent user', () => {
		expect(isAdmin('nope')).toBe(false)
	})
})

describe('canAccessVolume', () => {
	it('admin can access any volume', () => {
		createTestUser('admin1', 'admin', 'admin')
		createTestVolume('vol1', 'Test', '/tmp/test', 'private')
		expect(canAccessVolume('admin1', 'vol1')).toBe(true)
	})

	it('user can access public volume', () => {
		createTestUser('u1', 'alice')
		createTestVolume('vol1', 'Public', '/tmp/pub', 'public')
		expect(canAccessVolume('u1', 'vol1')).toBe(true)
	})

	it('user cannot access private volume without grant', () => {
		createTestUser('u1', 'alice')
		createTestVolume('vol1', 'Private', '/tmp/priv', 'private')
		expect(canAccessVolume('u1', 'vol1')).toBe(false)
	})

	it('user can access private volume with grant', () => {
		createTestUser('u1', 'alice')
		createTestVolume('vol1', 'Private', '/tmp/priv', 'private')
		grantVolumeAccess('vol1', 'u1')
		expect(canAccessVolume('u1', 'vol1')).toBe(true)
	})

	it('returns false for non-existent volume', () => {
		createTestUser('u1', 'alice')
		expect(canAccessVolume('u1', 'nope')).toBe(false)
	})
})

describe('getAccessibleVolumeIds', () => {
	it('admin gets all volumes', () => {
		createTestUser('admin1', 'admin', 'admin')
		createTestVolume('v1', 'A', '/tmp/a', 'public')
		createTestVolume('v2', 'B', '/tmp/b', 'private')
		const ids = getAccessibleVolumeIds('admin1')
		expect(ids).toContain('v1')
		expect(ids).toContain('v2')
	})

	it('user gets public + granted', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Public', '/tmp/pub', 'public')
		createTestVolume('v2', 'Private1', '/tmp/priv1', 'private')
		createTestVolume('v3', 'Private2', '/tmp/priv2', 'private')
		grantVolumeAccess('v2', 'u1')

		const ids = getAccessibleVolumeIds('u1')
		expect(ids).toContain('v1')
		expect(ids).toContain('v2')
		expect(ids).not.toContain('v3')
	})
})

describe('grantVolumeAccess / revokeVolumeAccess', () => {
	it('granting twice is idempotent', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t', 'private')
		grantVolumeAccess('v1', 'u1')
		grantVolumeAccess('v1', 'u1') // should not throw
		expect(canAccessVolume('u1', 'v1')).toBe(true)
	})

	it('revoke removes access', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t', 'private')
		grantVolumeAccess('v1', 'u1')
		expect(canAccessVolume('u1', 'v1')).toBe(true)
		revokeVolumeAccess('v1', 'u1')
		expect(canAccessVolume('u1', 'v1')).toBe(false)
	})
})

describe('getVolumeAccessList', () => {
	it('returns users with access', () => {
		createTestUser('u1', 'alice')
		createTestUser('u2', 'bob')
		createTestVolume('v1', 'Test', '/tmp/t', 'private')
		grantVolumeAccess('v1', 'u1')
		grantVolumeAccess('v1', 'u2')

		const list = getVolumeAccessList('v1')
		expect(list).toHaveLength(2)
		expect(list.map((u) => u.username).sort()).toEqual(['alice', 'bob'])
	})
})

describe('setVolumeVisibility', () => {
	it('changes visibility', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t', 'public')
		expect(canAccessVolume('u1', 'v1')).toBe(true)

		setVolumeVisibility('v1', 'private')
		expect(canAccessVolume('u1', 'v1')).toBe(false)
	})

	it('clears access list when set to public', () => {
		createTestUser('u1', 'alice')
		createTestUser('u2', 'bob')
		createTestVolume('v1', 'Test', '/tmp/t', 'private')
		grantVolumeAccess('v1', 'u1')
		grantVolumeAccess('v1', 'u2')
		expect(getVolumeAccessList('v1')).toHaveLength(2)

		setVolumeVisibility('v1', 'public')
		expect(getVolumeAccessList('v1')).toHaveLength(0)
	})

	it('does not clear access list when set to private', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t', 'private')
		grantVolumeAccess('v1', 'u1')

		setVolumeVisibility('v1', 'private')
		expect(getVolumeAccessList('v1')).toHaveLength(1)
	})
})

describe('listUsers', () => {
	it('returns all users ordered by created_at', () => {
		createTestUser('u1', 'alice')
		createTestUser('u2', 'bob', 'admin')
		const users = listUsers()
		expect(users).toHaveLength(2)
		expect(users[0].username).toBe('alice')
		expect(users[1].username).toBe('bob')
	})
})

describe('resetPasskeys', () => {
	it('clears credentials and sessions', () => {
		createTestUser('u1', 'alice')
		createTestCredential('cred1', 'u1')
		createTestCredential('cred2', 'u1')
		const db = getDb()
		db.prepare(
			"INSERT INTO sessions (jti, user_id, expires_at) VALUES ('s1', 'u1', datetime('now', '+1 day'))",
		).run()

		const removed = resetPasskeys('u1')
		expect(removed).toBe(2)

		const creds = db
			.prepare('SELECT COUNT(*) as c FROM credentials WHERE user_id = ?')
			.get('u1') as { c: number }
		expect(creds.c).toBe(0)

		const sessions = db
			.prepare('SELECT COUNT(*) as c FROM sessions WHERE user_id = ?')
			.get('u1') as { c: number }
		expect(sessions.c).toBe(0)
	})

	it('returns 0 for non-existent user', () => {
		expect(resetPasskeys('nope')).toBe(0)
	})
})

describe('deleteUser', () => {
	it('cannot delete admin', () => {
		createTestUser('u1', 'admin', 'admin')
		expect(deleteUser('u1')).toBe(false)
	})

	it('deletes regular user', () => {
		createTestUser('u1', 'alice')
		expect(deleteUser('u1')).toBe(true)
		expect(getUserById('u1')).toBeNull()
	})

	it('returns false for non-existent user', () => {
		expect(deleteUser('nope')).toBe(false)
	})
})
