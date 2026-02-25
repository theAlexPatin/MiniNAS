import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import { defineConfig } from 'astro/config'

function loadAppName() {
	// Read from ~/.mininas/config.json, then .env (same priority as API config)
	let name = 'MiniNAS'
	try {
		const cfg = JSON.parse(
			fs.readFileSync(path.join(os.homedir(), '.mininas', 'config.json'), 'utf-8'),
		)
		if (cfg.APP_NAME) name = cfg.APP_NAME
	} catch {}
	try {
		const env = fs.readFileSync(path.resolve(import.meta.dirname, '../../.env'), 'utf-8')
		const match = env.match(/^APP_NAME=(.+)$/m)
		if (match) name = match[1].trim()
	} catch {}
	// Real env var wins
	if (process.env.APP_NAME) name = process.env.APP_NAME
	return name
}

// Rewrite /volumes/X/Y/Z to /volumes so the catch-all [...path].astro
// page is served for all sub-paths (used in both dev and preview).
function volumesFallback(req, _res, next) {
	if (req.url?.startsWith('/volumes/') && !req.url.includes('.')) {
		req.url = '/volumes'
	}
	next()
}

export default defineConfig({
	devToolbar: { enabled: false },
	integrations: [react(), tailwind()],
	server: { port: 4321, host: '0.0.0.0' },
	vite: {
		define: {
			__APP_NAME_DEFAULT__: JSON.stringify(loadAppName()),
		},
		plugins: [
			{
				name: 'volumes-spa-fallback',
				configureServer(server) {
					server.middlewares.use(volumesFallback)
				},
			},
			{
				name: 'webdav-proxy',
				configureServer(server) {
					// Raw HTTP proxy for /dav so that WebDAV methods (OPTIONS,
					// PROPFIND, LOCK, etc.) are forwarded before Vite's built-in
					// CORS/OPTIONS handling can intercept them.
					server.middlewares.use((req, res, next) => {
						if (!req.url || !req.url.startsWith('/dav')) {
							return next()
						}
						const proxyReq = http.request(
							{
								hostname: 'localhost',
								port: 3001,
								path: req.url,
								method: req.method,
								headers: { ...req.headers, host: 'localhost:3001' },
							},
							(proxyRes) => {
								res.writeHead(proxyRes.statusCode, proxyRes.headers)
								proxyRes.pipe(res)
							},
						)
						proxyReq.on('error', () => {
							res.writeHead(502)
							res.end('Bad Gateway')
						})
						req.pipe(proxyReq)
					})
				},
			},
		],
		server: {
			allowedHosts: ['.ts.net'],
			proxy: {
				'/api': {
					target: 'http://localhost:3001',
					changeOrigin: true,
				},
			},
		},
	},
})
