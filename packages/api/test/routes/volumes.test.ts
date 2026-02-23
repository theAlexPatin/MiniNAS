import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { createTestSession, createTestUser, createTestVolume, resetDb } from '../helpers.js'

const testVolDir = join(tmpdir(), 'mininas-route-vol-test')

beforeEach(() => {
	resetDb()
	rmSync(testVolDir, { recursive: true, force: true })
	mkdirSync(testVolDir, { recursive: true })
})

describe('GET /api/v1/volumes', () => {
	it('returns 401 without auth', async () => {
		const res = await app.request('/api/v1/volumes')
		expect(res.status).toBe(401)
	})

	it('returns volumes for authenticated user', async () => {
		createTestUser('u1', 'admin', 'admin')
		createTestVolume('v1', 'Test Vol', testVolDir)
		const token = await createTestSession('u1')
		const res = await app.request('/api/v1/volumes', {
			headers: { Cookie: `session=${token}` },
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.volumes).toHaveLength(1)
		expect(body.volumes[0].id).toBe('v1')
		expect(body.volumes[0].label).toBe('Test Vol')
		expect(body.volumes[0].totalBytes).toBeDefined()
	})

	it('filters volumes by access for non-admin', async () => {
		createTestUser('u1', 'alice')
		createTestVolume('v1', 'Public', testVolDir, 'public')
		createTestVolume('v2', 'Private', testVolDir + '2', 'private')
		mkdirSync(testVolDir + '2', { recursive: true })
		const token = await createTestSession('u1')
		const res = await app.request('/api/v1/volumes', {
			headers: { Cookie: `session=${token}` },
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		// Should only see public volume
		expect(body.volumes).toHaveLength(1)
		expect(body.volumes[0].id).toBe('v1')
	})
})
