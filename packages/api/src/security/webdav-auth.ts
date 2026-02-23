import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { getUserById } from '../services/access.js'
import { verifyToken } from '../services/webdav-tokens.js'
import { setIdentity } from './types.js'

export const webdavAuthMiddleware = createMiddleware(async (c, next) => {
	// Allow unauthenticated OPTIONS so clients can discover DAV capabilities
	if (c.req.method === 'OPTIONS') {
		return next()
	}

	const authHeader = c.req.header('Authorization')

	if (!authHeader || !authHeader.startsWith('Basic ')) {
		c.header('WWW-Authenticate', 'Basic realm="MiniNAS WebDAV"')
		throw new HTTPException(401, { message: 'Authentication required' })
	}

	const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
	const colonIndex = decoded.indexOf(':')
	if (colonIndex === -1) {
		c.header('WWW-Authenticate', 'Basic realm="MiniNAS WebDAV"')
		throw new HTTPException(401, { message: 'Invalid credentials' })
	}

	const username = decoded.slice(0, colonIndex)
	const token = decoded.slice(colonIndex + 1)

	const result = verifyToken(username, token)
	if (!result) {
		c.header('WWW-Authenticate', 'Basic realm="MiniNAS WebDAV"')
		throw new HTTPException(401, { message: 'Invalid credentials' })
	}

	const user = getUserById(result.userId)
	setIdentity(c, {
		userId: result.userId,
		kind: 'webdav',
		sessionId: null,
		role: (user?.role as 'admin' | 'user') ?? 'user',
	})

	await next()
})
