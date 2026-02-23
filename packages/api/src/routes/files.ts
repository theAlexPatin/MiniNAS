import path from 'node:path'
import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { getIdentity } from '../security/index.js'
import { audit } from '../services/audit-log.js'
import {
	createDirectory,
	deleteEntry,
	getFileInfo,
	getVolume,
	listDirectory,
	moveEntry,
} from '../services/filesystem.js'
import { MkdirRequestSchema, MoveRequestSchema } from '../types/api.js'

const files = new Hono()

/**
 * Extract the relative path after /:volumeId/ from c.req.path.
 * c.req.param("*") doesn't work through nested route() calls in Hono,
 * so we parse c.req.path directly (same approach as the WebDAV router).
 */
function getRelativePath(c: Context): string {
	const volumeId = c.req.param('volumeId')
	const encoded = encodeURIComponent(volumeId)
	const sep = `/${encoded}/`
	const idx = c.req.path.lastIndexOf(sep)
	if (idx < 0) return ''
	const raw = c.req.path.substring(idx + sep.length)
	return raw.split('/').map(decodeURIComponent).join('/')
}

// --- List directory or get file metadata ---

files.get('/:volumeId', async (c) => {
	const { userId } = getIdentity(c)
	const volumeId = c.req.param('volumeId')
	const volume = getVolume(volumeId, userId)

	const entries = await listDirectory(volume, '.')
	return c.json({ entries, path: '', volume: volumeId })
})

files.get('/:volumeId/*', async (c) => {
	const { userId } = getIdentity(c)
	const volumeId = c.req.param('volumeId')
	const relativePath = getRelativePath(c)
	const volume = getVolume(volumeId, userId)

	const info = await getFileInfo(volume, relativePath || '.')
	if (info.isDirectory) {
		const entries = await listDirectory(volume, relativePath || '.')
		return c.json({ entries, path: relativePath, volume: volumeId })
	}
	return c.json(info)
})

// --- Delete file or directory ---

files.delete('/:volumeId', async (c) => {
	return c.json({ error: 'Cannot delete volume root' }, 403)
})

files.delete('/:volumeId/*', async (c) => {
	const { userId } = getIdentity(c)
	const volumeId = c.req.param('volumeId')
	const relativePath = getRelativePath(c)
	const volume = getVolume(volumeId, userId)

	if (!relativePath) {
		return c.json({ error: 'Cannot delete volume root' }, 403)
	}

	await deleteEntry(volume, relativePath)
	audit({ action: 'file.delete', userId, source: 'api', volumeId, path: relativePath })
	return c.json({ ok: true })
})

// --- Rename or move ---

files.patch('/:volumeId', async (c) => {
	return c.json({ error: 'Cannot move volume root' }, 403)
})

files.patch('/:volumeId/*', zValidator('json', MoveRequestSchema), async (c) => {
	const { userId } = getIdentity(c)
	const volumeId = c.req.param('volumeId')
	const relativePath = getRelativePath(c)
	const volume = getVolume(volumeId, userId)
	const { destination } = c.req.valid('json')

	if (!relativePath) {
		return c.json({ error: 'Cannot move volume root' }, 403)
	}

	await moveEntry(volume, relativePath, destination)
	audit({
		action: 'file.move',
		userId,
		source: 'api',
		volumeId,
		path: relativePath,
		dest: destination,
	})
	return c.json({ ok: true })
})

// --- Create directory ---

files.post('/:volumeId', zValidator('json', MkdirRequestSchema), async (c) => {
	const { userId } = getIdentity(c)
	const volumeId = c.req.param('volumeId')
	const volume = getVolume(volumeId, userId)
	const { name } = c.req.valid('json')

	await createDirectory(volume, '.', name)
	audit({ action: 'dir.create', userId, source: 'api', volumeId, path: name })
	return c.json({ ok: true }, 201)
})

files.post('/:volumeId/*', zValidator('json', MkdirRequestSchema), async (c) => {
	const { userId } = getIdentity(c)
	const volumeId = c.req.param('volumeId')
	const relativePath = getRelativePath(c)
	const volume = getVolume(volumeId, userId)
	const { name } = c.req.valid('json')

	await createDirectory(volume, relativePath || '.', name)
	audit({
		action: 'dir.create',
		userId,
		source: 'api',
		volumeId,
		path: path.join(relativePath || '.', name),
	})
	return c.json({ ok: true }, 201)
})

export default files
