import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '../../src/db/index.js'
import {
	createShareLink,
	deleteShareLink,
	getShareLink,
	incrementDownloadCount,
	listUserShares,
	validateShareLink,
} from '../../src/services/share.js'
import { createTestUser, createTestVolume, resetDb } from '../helpers.js'

beforeEach(() => resetDb())

describe('createShareLink', () => {
	it('creates a share link', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')

		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
		})

		expect(link.id).toBeDefined()
		expect(link.user_id).toBe('u1')
		expect(link.volume).toBe('v1')
		expect(link.path).toBe('file.txt')
		expect(link.password_hash).toBeNull()
		expect(link.max_downloads).toBeNull()
		expect(link.download_count).toBe(0)
		expect(link.expires_at).toBeNull()
	})

	it('creates with password', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')

		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
			password: 'secret123',
		})

		expect(link.password_hash).not.toBeNull()
		expect(link.password_hash).not.toBe('secret123') // Should be hashed
	})

	it('creates with expiration', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')

		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
			expiresInHours: 24,
		})

		expect(link.expires_at).not.toBeNull()
		const expiresAt = new Date(link.expires_at!)
		expect(expiresAt.getTime()).toBeGreaterThan(Date.now())
	})

	it('creates with max downloads', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')

		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
			maxDownloads: 5,
		})

		expect(link.max_downloads).toBe(5)
	})

	it('creates public share', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')

		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
			isPublic: true,
		})

		expect(link.is_public).toBe(1)
	})
})

describe('getShareLink', () => {
	it('returns null for non-existent link', () => {
		expect(getShareLink('nope')).toBeNull()
	})

	it('returns existing link', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')
		const created = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
		})

		const fetched = getShareLink(created.id)
		expect(fetched).not.toBeNull()
		expect(fetched!.id).toBe(created.id)
	})
})

describe('validateShareLink', () => {
	it('valid link passes', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')
		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
		})

		const result = validateShareLink(link)
		expect(result.valid).toBe(true)
	})

	it('expired link fails', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')

		// Insert an expired link with ISO timestamp
		const db = getDb()
		const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString()
		db.prepare(
			`INSERT INTO share_links (id, user_id, volume, path, expires_at)
       VALUES ('expired1', 'u1', 'v1', 'file.txt', ?)`,
		).run(pastDate)

		const link = getShareLink('expired1')!
		const result = validateShareLink(link)
		expect(result.valid).toBe(false)
		expect(result.error).toContain('expired')
	})

	it('download limit reached fails', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')
		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
			maxDownloads: 2,
		})

		incrementDownloadCount(link.id)
		incrementDownloadCount(link.id)

		const updated = getShareLink(link.id)!
		const result = validateShareLink(updated)
		expect(result.valid).toBe(false)
		expect(result.error).toContain('limit')
	})

	it('wrong password fails', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')
		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
			password: 'correct',
		})

		expect(validateShareLink(link, 'wrong').valid).toBe(false)
		expect(validateShareLink(link, 'wrong').error).toContain('password')
	})

	it('correct password passes', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')
		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
			password: 'correct',
		})

		expect(validateShareLink(link, 'correct').valid).toBe(true)
	})

	it('password required when set', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')
		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
			password: 'secret',
		})

		expect(validateShareLink(link).valid).toBe(false)
		expect(validateShareLink(link).error).toContain('required')
	})
})

describe('incrementDownloadCount', () => {
	it('increments the count', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')
		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
		})

		expect(getShareLink(link.id)!.download_count).toBe(0)
		incrementDownloadCount(link.id)
		expect(getShareLink(link.id)!.download_count).toBe(1)
		incrementDownloadCount(link.id)
		expect(getShareLink(link.id)!.download_count).toBe(2)
	})
})

describe('listUserShares', () => {
	it("returns only the user's shares", () => {
		createTestUser('u1', 'alice')
		createTestUser('u2', 'bob')
		createTestVolume('v1', 'Test', '/tmp/t')

		createShareLink({ userId: 'u1', volume: 'v1', path: 'a.txt' })
		createShareLink({ userId: 'u1', volume: 'v1', path: 'b.txt' })
		createShareLink({ userId: 'u2', volume: 'v1', path: 'c.txt' })

		expect(listUserShares('u1')).toHaveLength(2)
		expect(listUserShares('u2')).toHaveLength(1)
	})
})

describe('deleteShareLink', () => {
	it('deletes own share', () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Test', '/tmp/t')
		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
		})

		expect(deleteShareLink(link.id, 'u1')).toBe(true)
		expect(getShareLink(link.id)).toBeNull()
	})

	it("cannot delete another user's share", () => {
		createTestUser('u1', 'alice')
		createTestUser('u2', 'bob')
		createTestVolume('v1', 'Test', '/tmp/t')
		const link = createShareLink({
			userId: 'u1',
			volume: 'v1',
			path: 'file.txt',
		})

		expect(deleteShareLink(link.id, 'u2')).toBe(false)
		expect(getShareLink(link.id)).not.toBeNull()
	})
})
