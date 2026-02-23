import { spawn } from 'node:child_process'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { config } from '../config.js'
import { getDb } from '../db/index.js'
import { getIdentity } from '../security/index.js'
import { getUserById, resetPasskeys } from '../services/access.js'
import { scanVolume, unwatchVolume, watchVolume } from '../services/indexer.js'
import { createInvite } from '../services/invites.js'
import { addVolume, getVolumeById, removeVolume } from '../services/volumes.js'
import { createManagementRoutes } from './management.js'

const admin = new Hono()

// Shared management routes (users, invites list/delete, volume visibility/access)
admin.route('/', createManagementRoutes())

// --- Volumes (full CRUD) ---

admin.get('/volumes', (c) => {
	const db = getDb()
	const volumes = db.prepare('SELECT id, label, path, visibility FROM volumes ORDER BY rowid').all()
	return c.json({ volumes })
})

admin.post('/volumes', async (c) => {
	const body = await c.req.json()
	const { id, label, path } = body

	if (!id || !label || !path) {
		throw new HTTPException(400, {
			message: 'id, label, and path are required',
		})
	}

	try {
		addVolume(id, label, path)
	} catch (err: any) {
		if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
			throw new HTTPException(409, {
				message: `Volume with id '${id}' already exists`,
			})
		}
		if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
			throw new HTTPException(409, {
				message: `A volume with that path already exists`,
			})
		}
		throw new HTTPException(400, { message: err.message })
	}

	const volume = getVolumeById(id)!
	scanVolume(volume).then(() => watchVolume(volume))

	return c.json({ ok: true, id }, 201)
})

admin.delete('/volumes/:id', (c) => {
	const id = c.req.param('id')
	const volume = getVolumeById(id)
	if (!volume) {
		throw new HTTPException(404, { message: `Volume '${id}' not found` })
	}

	removeVolume(id)
	unwatchVolume(id)
	return c.json({ ok: true, volume })
})

// --- Users (reset passkeys) ---

admin.post('/users/:id/reset-passkeys', (c) => {
	const userId = c.req.param('id')
	const user = getUserById(userId)
	if (!user) {
		throw new HTTPException(404, { message: 'User not found' })
	}
	const count = resetPasskeys(userId)
	return c.json({ ok: true, username: user.username, removedCredentials: count })
})

// --- Invites (admin-specific: uses session.sub as creator) ---

admin.post('/invites', async (c) => {
	const { userId } = getIdentity(c)
	const body = await c.req.json()
	const { username, expiresInHours } = body

	if (!username || typeof username !== 'string') {
		throw new HTTPException(400, { message: 'username is required' })
	}

	const invite = createInvite(userId, username, expiresInHours)
	return c.json({ invite }, 201)
})

// --- Version & Update ---

admin.get('/version', (c) => {
	return c.json({ version: config.version })
})

admin.post('/update', async (c) => {
	// Spawn detached upgrade + restart — returns immediately
	const child = spawn('bash', ['-c', 'brew upgrade mininas && brew services restart mininas'], {
		detached: true,
		stdio: 'ignore',
	})
	child.unref()

	return c.json({ ok: true, message: 'Update started. The server will restart shortly.' })
})

export default admin
