import { readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'

const dist = new URL('./dist', import.meta.url).pathname
const port = parseInt(process.argv.find((a) => a.match(/^\d+$/)) || '4321')
const host = process.argv.includes('--host') ? '0.0.0.0' : '127.0.0.1'

// Optional base path support
function normalizeBasePath(raw) {
	if (!raw) return ''
	let p = raw.trim()
	if (!p.startsWith('/')) p = '/' + p
	return p.replace(/\/+$/, '')
}
const basePath = normalizeBasePath(process.env.BASE_PATH || '')

const mimeTypes = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.ico': 'image/x-icon',
}

function isFile(p) {
	try {
		return statSync(p).isFile()
	} catch {
		return false
	}
}

function tryFile(urlPath) {
	let file = join(dist, urlPath)
	if (isFile(file)) return file
	file = join(dist, urlPath, 'index.html')
	if (isFile(file)) return file
	return null
}

createServer((req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`)
	let pathname = url.pathname

	// Strip basePath before file lookup
	if (basePath && pathname.startsWith(basePath)) {
		pathname = pathname.slice(basePath.length) || '/'
	}

	let filePath = tryFile(pathname)

	// SPA fallback: /volumes/X/Y/Z -> /volumes/index.html
	if (!filePath && pathname.startsWith('/volumes/') && !extname(pathname)) {
		filePath = join(dist, 'volumes', 'index.html')
	}

	if (!filePath) {
		res.writeHead(404, { 'Content-Type': 'text/plain' })
		res.end('Not Found')
		return
	}

	const ext = extname(filePath)
	const mime = mimeTypes[ext] || 'application/octet-stream'
	let body = readFileSync(filePath)

	// Inject __BASE_PATH__ into HTML files
	if (ext === '.html') {
		let html = body.toString('utf-8')
		html = html.replace('<head>', `<head><script>window.__BASE_PATH__="${basePath}";</script>`)
		if (basePath) {
			html = html.replace(/href="\//g, `href="${basePath}/`)
			html = html.replace(/src="\//g, `src="${basePath}/`)
		}
		body = html
	}

	res.writeHead(200, {
		'Content-Type': mime,
		'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
	})
	res.end(body)
}).listen(port, host, () => {
	const prefix = basePath || ''
	console.log(`Preview server: http://${host}:${port}${prefix}/`)
})
