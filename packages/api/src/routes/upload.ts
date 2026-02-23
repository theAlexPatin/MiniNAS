import fs from 'node:fs'
import path from 'node:path'
import { FileStore } from '@tus/file-store'
import { Server } from '@tus/server'
import { Hono } from 'hono'
import { config } from '../config.js'
import { isAllowedOrigin } from '../lib/url.js'
import { getIdentity, getOptionalIdentity } from '../security/index.js'
import { canAccessVolume } from '../services/access.js'
import { audit } from '../services/audit-log.js'
import { getVolume, resolveVolumePath } from '../services/filesystem.js'

// Ensure staging directory exists
fs.mkdirSync(config.uploadStagingDir, { recursive: true })

const tusServer = new Server({
	path: `${config.basePath}/api/v1/upload`,
	datastore: new FileStore({
		directory: config.uploadStagingDir,
	}),
	respectForwardedHeaders: true,
	onUploadFinish: async (req, res, upload) => {
		// Parse metadata to determine target location
		const metadata = upload.metadata
		if (!metadata) return res

		const volumeId = metadata.volume
		const targetDir = metadata.directory || ''
		const fileName = metadata.filename || upload.id
		// relativePath preserves folder structure (e.g. "MyFolder/sub/file.txt")
		const relativePath = metadata.relativePath

		if (!volumeId) return res

		try {
			const volume = getVolume(volumeId)
			const fileDest = relativePath || fileName
			const targetPath = resolveVolumePath(volume, path.join(targetDir, fileDest))

			// Ensure parent directory exists
			const parentDir = path.dirname(targetPath)
			fs.mkdirSync(parentDir, { recursive: true })

			// Move file from staging to target (copyFile + unlink to handle cross-device moves)
			const stagingPath = path.join(config.uploadStagingDir, upload.id)
			fs.copyFileSync(stagingPath, targetPath)
			fs.unlinkSync(stagingPath)

			// Clean up .json metadata file
			const metaPath = `${stagingPath}.json`
			if (fs.existsSync(metaPath)) {
				fs.unlinkSync(metaPath)
			}

			const userId = (req as any).__userId || 'unknown'
			audit({
				action: 'file.create',
				userId,
				source: 'upload',
				volumeId,
				path: path.join(targetDir, fileDest),
			})
		} catch (err) {
			console.error('Error moving uploaded file:', err)
		}

		return res
	},
})

const upload = new Hono()

// Validate volume access on upload creation (POST)
upload.post('/*', async (c, next) => {
	const { userId } = getIdentity(c)
	const uploadMetadata = c.req.header('upload-metadata')
	if (uploadMetadata) {
		// TUS metadata is comma-separated key-value pairs, values are base64-encoded
		const parts = uploadMetadata.split(',').map((p) => p.trim())
		for (const part of parts) {
			const [key, value] = part.split(' ')
			if (key === 'volume' && value) {
				const volumeId = Buffer.from(value, 'base64').toString('utf-8')
				getVolume(volumeId, userId) // throws 403 if denied
			}
		}
	}
	await next()
})

// Bridge all tus methods to the tus server using raw Node.js req/res.
// The tus server writes directly to the Node.js response, bypassing Hono's
// middleware pipeline, so we must set CORS headers on the raw response ourselves.
upload.all('/*', async (c) => {
	const req = c.env.incoming
	const res = c.env.outgoing

	if (!req || !res) {
		return c.json({ error: 'Upload requires Node.js server' }, 500)
	}

	// Stash userId on raw request so TUS onUploadFinish can access it
	const identity = getOptionalIdentity(c)
	if (identity) {
		;(req as any).__userId = identity.userId
	}

	const origin = c.req.header('origin')
	if (origin && isAllowedOrigin(origin, c)) {
		res.setHeader('Access-Control-Allow-Origin', origin)
		res.setHeader('Access-Control-Allow-Credentials', 'true')
		res.setHeader(
			'Access-Control-Allow-Headers',
			'Content-Type, Authorization, Tus-Resumable, Upload-Length, Upload-Offset, Upload-Metadata',
		)
		res.setHeader(
			'Access-Control-Expose-Headers',
			'Content-Range, Accept-Ranges, Content-Length, Tus-Resumable, Upload-Offset, Upload-Length, Location',
		)
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD')
	}

	await tusServer.handle(req, res)
	return new Response(null) // Response already sent via res
})

export default upload

// Cleanup abandoned uploads older than 24 hours
export function cleanupStagingDir() {
	const maxAge = 24 * 60 * 60 * 1000 // 24 hours
	const now = Date.now()

	try {
		const files = fs.readdirSync(config.uploadStagingDir)
		for (const file of files) {
			const filePath = path.join(config.uploadStagingDir, file)
			const stat = fs.statSync(filePath)
			if (now - stat.mtimeMs > maxAge) {
				fs.unlinkSync(filePath)
			}
		}
	} catch {
		// Ignore cleanup errors
	}
}
