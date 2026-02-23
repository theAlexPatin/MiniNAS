import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { getIdentity } from './types.js'

/**
 * Gate access by role. Must be stacked after an auth middleware that sets Identity.
 * Throws 403 if the identity's role is not in the allowed set.
 */
export function requireRole(...roles: Array<'admin' | 'user'>) {
	return createMiddleware(async (c, next) => {
		const identity = getIdentity(c)
		if (!roles.includes(identity.role)) {
			throw new HTTPException(403, {
				message: `Forbidden: requires role ${roles.join(' or ')}`,
			})
		}
		await next()
	})
}
