import { cors } from 'hono/cors'
import { isAllowedOrigin } from '../lib/url.js'

export const corsMiddleware = cors({
	origin: (origin, c) => {
		return isAllowedOrigin(origin, c) ? origin : null
	},
	credentials: true,
	allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
	allowHeaders: [
		'Content-Type',
		'Authorization',
		'Tus-Resumable',
		'Upload-Length',
		'Upload-Offset',
		'Upload-Metadata',
	],
	exposeHeaders: [
		'Content-Range',
		'Accept-Ranges',
		'Content-Length',
		'Tus-Resumable',
		'Upload-Offset',
		'Upload-Length',
		'Location',
	],
})
