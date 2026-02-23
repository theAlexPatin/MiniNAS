import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'

export interface AuditEntry {
	action: 'file.create' | 'file.delete' | 'file.move' | 'file.copy' | 'dir.create'
	userId: string
	source: 'api' | 'webdav' | 'upload'
	volumeId: string
	path: string
	dest?: string
}

const RETENTION_DAYS = 90

let currentDate = ''
let currentStream: fs.WriteStream | null = null

function todayStr(): string {
	return new Date().toISOString().slice(0, 10)
}

function ensureDir(): void {
	fs.mkdirSync(config.auditLogDir, { recursive: true })
}

function getStream(): fs.WriteStream {
	const today = todayStr()
	if (currentStream && currentDate === today) {
		return currentStream
	}
	// Roll to new day
	if (currentStream) {
		currentStream.end()
	}
	ensureDir()
	currentDate = today
	currentStream = fs.createWriteStream(path.join(config.auditLogDir, `${today}.jsonl`), {
		flags: 'a',
	})
	currentStream.on('error', (err) => {
		console.error('Audit log write error:', err)
	})
	return currentStream
}

export function audit(entry: AuditEntry): void {
	try {
		const line = JSON.stringify({ ts: new Date().toISOString(), ...entry })
		getStream().write(line + '\n')
	} catch {
		// Never throw — audit logging is best-effort
	}
}

export async function cleanupOldLogs(): Promise<void> {
	try {
		ensureDir()
		const files = await fsPromises.readdir(config.auditLogDir)
		const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

		for (const file of files) {
			if (!file.endsWith('.jsonl')) continue
			const dateStr = file.replace('.jsonl', '')
			const fileDate = new Date(dateStr)
			if (isNaN(fileDate.getTime())) continue
			if (fileDate.getTime() < cutoff) {
				await fsPromises.unlink(path.join(config.auditLogDir, file))
			}
		}
	} catch {
		// Ignore cleanup errors
	}
}

export function closeAuditLog(): void {
	if (currentStream) {
		currentStream.end()
		currentStream = null
		currentDate = ''
	}
}
