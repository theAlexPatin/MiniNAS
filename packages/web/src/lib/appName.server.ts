import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let cached: string | null = null

export function getAppName(): string {
	if (cached) return cached
	let name = 'MiniNAS'
	try {
		const cfg = JSON.parse(
			fs.readFileSync(path.join(os.homedir(), '.mininas', 'config.json'), 'utf-8'),
		)
		if (cfg.APP_NAME) name = cfg.APP_NAME
	} catch {}
	try {
		const root = path.resolve(import.meta.dirname, '../../../../.env')
		const env = fs.readFileSync(root, 'utf-8')
		const match = env.match(/^APP_NAME=(.+)$/m)
		if (match) name = match[1].trim()
	} catch {}
	if (process.env.APP_NAME) name = process.env.APP_NAME
	cached = name
	return name
}
