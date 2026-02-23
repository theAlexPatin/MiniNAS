import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import {
	createTestCredential,
	createTestSession,
	createTestUser,
	createTestVolume,
	resetDb,
} from '../helpers.js'

const API = '/api/v1/admin'

// Create a real temp directory for volume path validation (addVolume checks fs.existsSync)
const testVolDir = join(tmpdir(), `mininas-admin-test-${randomUUID()}`)
mkdirSync(testVolDir, { recursive: true })

function adminHeaders(token: string) {
	return { Cookie: `session=${token}` }
}

function jsonHeaders(token: string) {
	return { ...adminHeaders(token), 'Content-Type': 'application/json' }
}

beforeEach(() => resetDb())

// Helper: create admin user + session
async function setup() {
	createTestUser('admin1', 'admin', 'admin')
	return createTestSession('admin1')
}

// ---------------------------------------------------------------------------
// Auth & authorization middleware
// ---------------------------------------------------------------------------
describe('admin auth middleware', () => {
	it('returns 401 without a session cookie', async () => {
		const res = await app.request(`${API}/volumes`)
		expect(res.status).toBe(401)
	})

	it('returns 401 with an invalid session token', async () => {
		const res = await app.request(`${API}/volumes`, {
			headers: adminHeaders('bogus-token'),
		})
		expect(res.status).toBe(401)
	})

	it('returns 403 when a non-admin user accesses admin routes', async () => {
		createTestUser('u1', 'alice', 'user')
		const token = await createTestSession('u1')
		const res = await app.request(`${API}/volumes`, {
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(403)
	})
})

// ---------------------------------------------------------------------------
// GET /admin/volumes — list all volumes
// ---------------------------------------------------------------------------
describe('GET /admin/volumes', () => {
	it('returns empty list when no volumes exist', async () => {
		const token = await setup()
		const res = await app.request(`${API}/volumes`, {
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.volumes).toEqual([])
	})

	it('returns all volumes with id, label, path, and visibility', async () => {
		const token = await setup()
		createTestVolume('media', 'Media', '/mnt/media', 'public')
		createTestVolume('backup', 'Backup', '/mnt/backup', 'private')

		const res = await app.request(`${API}/volumes`, {
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.volumes).toHaveLength(2)
		expect(body.volumes[0]).toMatchObject({
			id: 'media',
			label: 'Media',
			path: '/mnt/media',
			visibility: 'public',
		})
		expect(body.volumes[1]).toMatchObject({
			id: 'backup',
			label: 'Backup',
			path: '/mnt/backup',
			visibility: 'private',
		})
	})
})

// ---------------------------------------------------------------------------
// POST /admin/volumes — add volume
// ---------------------------------------------------------------------------
describe('POST /admin/volumes', () => {
	it('creates a volume and returns 201', async () => {
		const token = await setup()
		const volPath = join(testVolDir, 'docs')
		mkdirSync(volPath, { recursive: true })
		const res = await app.request(`${API}/volumes`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ id: 'docs', label: 'Documents', path: volPath }),
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body).toEqual({ ok: true, id: 'docs' })

		// Verify it appears in the list
		const listRes = await app.request(`${API}/volumes`, {
			headers: adminHeaders(token),
		})
		const listBody = await listRes.json()
		expect(listBody.volumes).toHaveLength(1)
		expect(listBody.volumes[0].id).toBe('docs')
	})

	it('returns 400 when id is missing', async () => {
		const token = await setup()
		const res = await app.request(`${API}/volumes`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ label: 'Documents', path: '/mnt/docs' }),
		})
		expect(res.status).toBe(400)
	})

	it('returns 400 when label is missing', async () => {
		const token = await setup()
		const res = await app.request(`${API}/volumes`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ id: 'docs', path: '/mnt/docs' }),
		})
		expect(res.status).toBe(400)
	})

	it('returns 400 when path is missing', async () => {
		const token = await setup()
		const res = await app.request(`${API}/volumes`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ id: 'docs', label: 'Documents' }),
		})
		expect(res.status).toBe(400)
	})

	it('returns 400 when path does not exist on disk', async () => {
		const token = await setup()
		const res = await app.request(`${API}/volumes`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ id: 'ghost', label: 'Ghost', path: '/nonexistent/path' }),
		})
		expect(res.status).toBe(400)
	})

	it('returns 409 for duplicate volume id', async () => {
		const token = await setup()
		const volPath1 = join(testVolDir, 'dup-id-1')
		const volPath2 = join(testVolDir, 'dup-id-2')
		mkdirSync(volPath1, { recursive: true })
		mkdirSync(volPath2, { recursive: true })
		createTestVolume('docs', 'Documents', volPath1)
		const res = await app.request(`${API}/volumes`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ id: 'docs', label: 'Other', path: volPath2 }),
		})
		expect(res.status).toBe(409)
		const body = await res.json()
		expect(body.error).toContain('already exists')
	})

	it('returns 409 for duplicate volume path', async () => {
		const token = await setup()
		const volPath = join(testVolDir, 'dup-path')
		mkdirSync(volPath, { recursive: true })
		createTestVolume('docs', 'Documents', volPath)
		const res = await app.request(`${API}/volumes`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ id: 'other', label: 'Other', path: volPath }),
		})
		expect(res.status).toBe(409)
		const body = await res.json()
		expect(body.error).toContain('path already exists')
	})
})

// ---------------------------------------------------------------------------
// DELETE /admin/volumes/:id — remove volume
// ---------------------------------------------------------------------------
describe('DELETE /admin/volumes/:id', () => {
	it('deletes an existing volume', async () => {
		const token = await setup()
		createTestVolume('docs', 'Documents', '/mnt/docs')

		const res = await app.request(`${API}/volumes/docs`, {
			method: 'DELETE',
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.ok).toBe(true)
		expect(body.volume).toMatchObject({ id: 'docs' })

		// Verify it's gone
		const listRes = await app.request(`${API}/volumes`, {
			headers: adminHeaders(token),
		})
		const listBody = await listRes.json()
		expect(listBody.volumes).toHaveLength(0)
	})

	it('returns 404 for non-existent volume', async () => {
		const token = await setup()
		const res = await app.request(`${API}/volumes/nope`, {
			method: 'DELETE',
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(404)
	})

	it('handles URL-encoded volume ids', async () => {
		const token = await setup()
		createTestVolume('my docs', 'My Documents', '/mnt/mydocs')

		const res = await app.request(`${API}/volumes/${encodeURIComponent('my docs')}`, {
			method: 'DELETE',
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(200)
	})
})

// ---------------------------------------------------------------------------
// POST /admin/users/:id/reset-passkeys
// ---------------------------------------------------------------------------
describe('POST /admin/users/:id/reset-passkeys', () => {
	it('resets passkeys and returns the count', async () => {
		const token = await setup()
		createTestUser('u2', 'alice')
		createTestCredential('cred1', 'u2')
		createTestCredential('cred2', 'u2')

		const res = await app.request(`${API}/users/u2/reset-passkeys`, {
			method: 'POST',
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toMatchObject({
			ok: true,
			username: 'alice',
			removedCredentials: 2,
		})
	})

	it('returns 0 removed credentials when user has no passkeys', async () => {
		const token = await setup()
		createTestUser('u2', 'alice')

		const res = await app.request(`${API}/users/u2/reset-passkeys`, {
			method: 'POST',
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.removedCredentials).toBe(0)
	})

	it('returns 404 for non-existent user', async () => {
		const token = await setup()
		const res = await app.request(`${API}/users/nonexistent/reset-passkeys`, {
			method: 'POST',
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(404)
	})
})

// ---------------------------------------------------------------------------
// POST /admin/invites — create invite
// ---------------------------------------------------------------------------
describe('POST /admin/invites', () => {
	it('creates an invite and returns 201', async () => {
		const token = await setup()
		const res = await app.request(`${API}/invites`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ username: 'newuser' }),
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.invite).toBeDefined()
		expect(body.invite.username).toBe('newuser')
		expect(body.invite.id).toBeDefined()
		expect(body.invite.created_by).toBe('admin1')
	})

	it('creates an invite with custom expiration', async () => {
		const token = await setup()
		const res = await app.request(`${API}/invites`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ username: 'newuser', expiresInHours: 48 }),
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		// Verify expiration is roughly 48 hours from now
		const expiresAt = new Date(body.invite.expires_at).getTime()
		const expected = Date.now() + 48 * 60 * 60 * 1000
		expect(Math.abs(expiresAt - expected)).toBeLessThan(10_000)
	})

	it('returns 400 when username is missing', async () => {
		const token = await setup()
		const res = await app.request(`${API}/invites`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(400)
	})

	it('returns 400 when username is not a string', async () => {
		const token = await setup()
		const res = await app.request(`${API}/invites`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ username: 123 }),
		})
		expect(res.status).toBe(400)
	})

	it('shows up in invite list after creation', async () => {
		const token = await setup()
		await app.request(`${API}/invites`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ username: 'bob' }),
		})

		const listRes = await app.request(`${API}/invites`, {
			headers: adminHeaders(token),
		})
		const listBody = await listRes.json()
		expect(listBody.invites).toHaveLength(1)
		expect(listBody.invites[0].username).toBe('bob')
	})
})

// ---------------------------------------------------------------------------
// GET /admin/version
// ---------------------------------------------------------------------------
describe('GET /admin/version', () => {
	it('returns the version string', async () => {
		const token = await setup()
		const res = await app.request(`${API}/version`, {
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.version).toBeDefined()
		expect(typeof body.version).toBe('string')
	})
})

// ---------------------------------------------------------------------------
// Integration: full volume lifecycle
// ---------------------------------------------------------------------------
describe('volume lifecycle (create → list → update visibility → grant access → delete)', () => {
	it('performs a full CRUD cycle', async () => {
		const token = await setup()
		createTestUser('u2', 'alice')

		// Create
		const photosPath = join(testVolDir, 'photos')
		mkdirSync(photosPath, { recursive: true })
		let res = await app.request(`${API}/volumes`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ id: 'photos', label: 'Photos', path: photosPath }),
		})
		expect(res.status).toBe(201)

		// List — verify it exists
		res = await app.request(`${API}/volumes`, {
			headers: adminHeaders(token),
		})
		let body = await res.json()
		expect(body.volumes).toHaveLength(1)
		expect(body.volumes[0].visibility).toBe('public')

		// Set private
		res = await app.request(`${API}/volumes/photos/visibility`, {
			method: 'PATCH',
			headers: jsonHeaders(token),
			body: JSON.stringify({ visibility: 'private' }),
		})
		expect(res.status).toBe(200)

		// Grant access to alice
		res = await app.request(`${API}/volumes/photos/access`, {
			method: 'POST',
			headers: jsonHeaders(token),
			body: JSON.stringify({ userId: 'u2' }),
		})
		expect(res.status).toBe(201)

		// Verify access list
		res = await app.request(`${API}/volumes/photos/access`, {
			headers: adminHeaders(token),
		})
		body = await res.json()
		expect(body.users).toHaveLength(1)
		expect(body.users[0].username).toBe('alice')

		// Delete volume
		res = await app.request(`${API}/volumes/photos`, {
			method: 'DELETE',
			headers: adminHeaders(token),
		})
		expect(res.status).toBe(200)

		// Verify it's gone
		res = await app.request(`${API}/volumes`, {
			headers: adminHeaders(token),
		})
		body = await res.json()
		expect(body.volumes).toHaveLength(0)
	})
})
