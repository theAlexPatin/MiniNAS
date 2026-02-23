import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { getUserById } from '../services/access.js'
import { verifySession } from '../services/sessions.js'
import { setIdentity } from './types.js'

/**
 * Cookie-based JWT session authentication.
 *
 * - "required": throws 401 if no valid session. Identity is always set.
 * - "optional": sets identity if a valid session exists, continues without one otherwise.
 */
export function resolveIdentity(strategy: 'required' | 'optional') {
	return createMiddleware(async (c, next) => {
		const token = getCookie(c, 'session')

		if (token) {
			const session = await verifySession(token)
			if (session) {
				const user = getUserById(session.sub)
				if (user) {
					setIdentity(c, {
						userId: session.sub,
						kind: 'session',
						sessionId: session.jti,
						role: user.role as 'admin' | 'user',
					})
					return next()
				}
			}
		}

		if (strategy === 'required') {
			throw new HTTPException(401, { message: 'Unauthorized' })
		}

		await next()
	})
}
