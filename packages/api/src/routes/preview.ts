import fs from 'node:fs'
import type { Context } from 'hono'
import { Hono } from 'hono'
import mime from 'mime-types'
import { getIdentity } from '../security/index.js'
import { getVolume, resolveVolumePath } from '../services/filesystem.js'
import { getThumbnailPath, type ThumbnailSize } from '../services/thumbnails.js'

const preview = new Hono()

/**
 * Extract the relative path after /:volumeId/ from c.req.path.
 * c.req.param("*") doesn't work through nested route() calls in Hono.
 */
function getRelativePath(c: Context): string {
	const volumeId = c.req.param('volumeId')
	const encoded = encodeURIComponent(volumeId)
	const sep = `/${encoded}/`
	const idx = c.req.path.lastIndexOf(sep)
	if (idx < 0) return ''
	const raw = c.req.path.substring(idx + sep.length)
	// Strip query string if present in path
	const clean = raw.split('?')[0]
	return clean.split('/').map(decodeURIComponent).join('/')
}

// /:volumeId alone would be a directory — no preview
preview.get('/:volumeId', async (c) => {
	return c.json({ error: 'No preview available' }, 404)
})

preview.get('/:volumeId/*', async (c) => {
	const { userId } = getIdentity(c)
	const volumeId = c.req.param('volumeId')
	const relativePath = getRelativePath(c)
	const size = (c.req.query('size') || 'small') as ThumbnailSize

	const volume = getVolume(volumeId, userId)
	const filePath = resolveVolumePath(volume, relativePath)
	const mimeType = mime.lookup(filePath) || null

	const thumbPath = await getThumbnailPath(filePath, volumeId, relativePath, mimeType, size)

	if (!thumbPath || !fs.existsSync(thumbPath)) {
		return c.json({ error: 'No preview available' }, 404)
	}

	const data = fs.readFileSync(thumbPath)
	c.header('Content-Type', 'image/webp')
	c.header('Cache-Control', 'public, max-age=86400')
	return c.body(data)
})

export default preview
