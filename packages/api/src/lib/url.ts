import type { Context } from 'hono'
import { config } from '../config.js'

/**
 * Check whether the given Origin header value should be allowed for CORS.
 * Matches against config.rp.origin, config.baseUrl, and the Host-derived origin.
 */
export function isAllowedOrigin(origin: string, c: Context): boolean {
	if (origin === config.rp.origin) return true
	if (config.baseUrl && origin === config.baseUrl) return true

	const host = c.req.header('Host')
	if (host) {
		const proto = c.req.header('X-Forwarded-Proto') || 'https'
		if (origin === `${proto}://${host}`) return true
	}

	return false
}

export function getBaseUrl(c: Context): string {
	const host = c.req.header('Host')
	if (host) {
		const proto = c.req.header('X-Forwarded-Proto') || 'https'
		return `${proto}://${host}${config.basePath}`
	}
	return config.baseUrl
		? `${config.baseUrl}${config.basePath}`
		: `http://localhost:${config.port}${config.basePath}`
}
