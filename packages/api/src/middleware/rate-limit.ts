import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

interface RateLimitEntry {
	count: number
	resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up stale entries every 5 minutes
setInterval(
	() => {
		const now = Date.now()
		for (const [key, entry] of store) {
			if (entry.resetAt < now) store.delete(key)
		}
	},
	5 * 60 * 1000,
)

export function rateLimit(maxRequests: number, windowMs: number) {
	return createMiddleware(async (c, next) => {
		const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
		const key = `${ip}:${c.req.path}`
		const now = Date.now()

		let entry = store.get(key)
		if (!entry || entry.resetAt < now) {
			entry = { count: 0, resetAt: now + windowMs }
			store.set(key, entry)
		}

		entry.count++

		if (entry.count > maxRequests) {
			throw new HTTPException(429, { message: 'Too many requests' })
		}

		await next()
	})
}

export const authRateLimit = rateLimit(10, 60 * 1000) // 10 per minute
