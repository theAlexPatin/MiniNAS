import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { grantVolumeAccess } from '../../src/services/access.js'
import { createInvite } from '../../src/services/invites.js'
import { createTestSession, createTestUser, createTestVolume, resetDb } from '../helpers.js'

const CLI_TOKEN = 'test-cli-secret'

function adminHeaders(token: string) {
	return { Cookie: `session=${token}` }
}

function cliHeaders() {
	return { 'X-CLI-Token': CLI_TOKEN }
}

beforeEach(() => resetDb())

// Test shared management routes through both admin and CLI interfaces
// to ensure the extracted handlers work identically in both contexts.

describe('shared management routes via admin API', () => {
	async function setup() {
		createTestUser('admin1', 'admin', 'admin')
		const token = await createTestSession('admin1')
		return token
	}

	describe('GET /api/v1/admin/users', () => {
		it('lists users', async () => {
			const token = await setup()
			createTestUser('u2', 'alice')
			const res = await app.request('/api/v1/admin/users', {
				headers: adminHeaders(token),
			})
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body.users).toHaveLength(2)
		})
	})

	describe('DELETE /api/v1/admin/users/:id', () => {
		it('deletes a non-admin user', async () => {
			const token = await setup()
			createTestUser('u2', 'alice')
			const res = await app.request('/api/v1/admin/users/u2', {
				method: 'DELETE',
				headers: adminHeaders(token),
			})
			expect(res.status).toBe(200)
		})

		it('returns 400 when deleting admin', async () => {
			const token = await setup()
			const res = await app.request('/api/v1/admin/users/admin1', {
				method: 'DELETE',
				headers: adminHeaders(token),
			})
			expect(res.status).toBe(400)
		})
	})

	describe('GET /api/v1/admin/invites', () => {
		it('lists invites', async () => {
			const token = await setup()
			createInvite('admin1', 'newuser')
			const res = await app.request('/api/v1/admin/invites', {
				headers: adminHeaders(token),
			})
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body.invites).toHaveLength(1)
		})
	})

	describe('DELETE /api/v1/admin/invites/:id', () => {
		it('deletes an invite', async () => {
			const token = await setup()
			const invite = createInvite('admin1', 'newuser')
			const res = await app.request(`/api/v1/admin/invites/${invite.id}`, {
				method: 'DELETE',
				headers: adminHeaders(token),
			})
			expect(res.status).toBe(200)
		})

		it('returns 404 for non-existent invite', async () => {
			const token = await setup()
			const res = await app.request('/api/v1/admin/invites/nope', {
				method: 'DELETE',
				headers: adminHeaders(token),
			})
			expect(res.status).toBe(404)
		})
	})

	describe('PATCH /api/v1/admin/volumes/:id/visibility', () => {
		it('sets volume visibility', async () => {
			const token = await setup()
			createTestVolume('v1', 'Test', '/tmp/test-vol')
			const res = await app.request('/api/v1/admin/volumes/v1/visibility', {
				method: 'PATCH',
				headers: {
					...adminHeaders(token),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ visibility: 'private' }),
			})
			expect(res.status).toBe(200)
		})

		it('rejects invalid visibility', async () => {
			const token = await setup()
			createTestVolume('v1', 'Test', '/tmp/test-vol')
			const res = await app.request('/api/v1/admin/volumes/v1/visibility', {
				method: 'PATCH',
				headers: {
					...adminHeaders(token),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ visibility: 'invalid' }),
			})
			expect(res.status).toBe(400)
		})

		it('returns 404 for non-existent volume', async () => {
			const token = await setup()
			const res = await app.request('/api/v1/admin/volumes/nope/visibility', {
				method: 'PATCH',
				headers: {
					...adminHeaders(token),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ visibility: 'private' }),
			})
			expect(res.status).toBe(404)
		})
	})

	describe('volume access endpoints', () => {
		it('lists volume access', async () => {
			const token = await setup()
			createTestVolume('v1', 'Test', '/tmp/test-vol', 'private')
			createTestUser('u2', 'alice')
			grantVolumeAccess('v1', 'u2')

			const res = await app.request('/api/v1/admin/volumes/v1/access', {
				headers: adminHeaders(token),
			})
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body.users).toHaveLength(1)
		})

		it('grants volume access', async () => {
			const token = await setup()
			createTestVolume('v1', 'Test', '/tmp/test-vol', 'private')
			createTestUser('u2', 'alice')

			const res = await app.request('/api/v1/admin/volumes/v1/access', {
				method: 'POST',
				headers: {
					...adminHeaders(token),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ userId: 'u2' }),
			})
			expect(res.status).toBe(201)
		})

		it('rejects granting access to public volume', async () => {
			const token = await setup()
			createTestVolume('v1', 'Test', '/tmp/test-vol', 'public')
			createTestUser('u2', 'alice')

			const res = await app.request('/api/v1/admin/volumes/v1/access', {
				method: 'POST',
				headers: {
					...adminHeaders(token),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ userId: 'u2' }),
			})
			expect(res.status).toBe(400)
		})

		it('rejects granting access to admin user', async () => {
			const token = await setup()
			createTestVolume('v1', 'Test', '/tmp/test-vol', 'private')
			createTestUser('admin2', 'admin2', 'admin')

			const res = await app.request('/api/v1/admin/volumes/v1/access', {
				method: 'POST',
				headers: {
					...adminHeaders(token),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ userId: 'admin2' }),
			})
			expect(res.status).toBe(400)
		})

		it('revokes volume access', async () => {
			const token = await setup()
			createTestVolume('v1', 'Test', '/tmp/test-vol', 'private')
			createTestUser('u2', 'alice')
			grantVolumeAccess('v1', 'u2')

			const res = await app.request('/api/v1/admin/volumes/v1/access/u2', {
				method: 'DELETE',
				headers: adminHeaders(token),
			})
			expect(res.status).toBe(200)
		})
	})
})

describe('shared management routes via CLI API', () => {
	beforeEach(() => {
		createTestUser('admin1', 'admin', 'admin')
	})

	describe('GET /api/v1/cli/users', () => {
		it('lists users', async () => {
			createTestUser('u2', 'alice')
			const res = await app.request('/api/v1/cli/users', {
				headers: cliHeaders(),
			})
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body.users).toHaveLength(2)
		})

		it('returns 403 without CLI token', async () => {
			const res = await app.request('/api/v1/cli/users')
			expect(res.status).toBe(403)
		})
	})

	describe('DELETE /api/v1/cli/users/:id', () => {
		it('deletes a non-admin user', async () => {
			createTestUser('u2', 'alice')
			const res = await app.request('/api/v1/cli/users/u2', {
				method: 'DELETE',
				headers: cliHeaders(),
			})
			expect(res.status).toBe(200)
		})
	})

	describe('PATCH /api/v1/cli/volumes/:id/visibility', () => {
		it('sets volume visibility', async () => {
			createTestVolume('v1', 'Test', '/tmp/test-vol')
			const res = await app.request('/api/v1/cli/volumes/v1/visibility', {
				method: 'PATCH',
				headers: {
					...cliHeaders(),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ visibility: 'private' }),
			})
			expect(res.status).toBe(200)
		})
	})

	describe('volume access endpoints', () => {
		it('full grant/list/revoke cycle', async () => {
			createTestVolume('v1', 'Test', '/tmp/test-vol', 'private')
			createTestUser('u2', 'alice')

			// Grant
			let res = await app.request('/api/v1/cli/volumes/v1/access', {
				method: 'POST',
				headers: {
					...cliHeaders(),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ userId: 'u2' }),
			})
			expect(res.status).toBe(201)

			// List
			res = await app.request('/api/v1/cli/volumes/v1/access', {
				headers: cliHeaders(),
			})
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body.users).toHaveLength(1)

			// Revoke
			res = await app.request('/api/v1/cli/volumes/v1/access/u2', {
				method: 'DELETE',
				headers: cliHeaders(),
			})
			expect(res.status).toBe(200)
		})
	})

	describe('invite endpoints', () => {
		it('lists and deletes invites', async () => {
			const invite = createInvite('admin1', 'newuser')

			let res = await app.request('/api/v1/cli/invites', {
				headers: cliHeaders(),
			})
			expect(res.status).toBe(200)
			let body = await res.json()
			expect(body.invites).toHaveLength(1)

			res = await app.request(`/api/v1/cli/invites/${invite.id}`, {
				method: 'DELETE',
				headers: cliHeaders(),
			})
			expect(res.status).toBe(200)

			res = await app.request('/api/v1/cli/invites', {
				headers: cliHeaders(),
			})
			body = await res.json()
			expect(body.invites).toHaveLength(0)
		})
	})
})
