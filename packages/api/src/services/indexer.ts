import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { watch } from 'chokidar'
import mime from 'mime-types'
import type { VolumeConfig } from '../config.js'
import { getDb } from '../db/index.js'
import { getVolumes } from './volumes.js'

const watchers = new Map<string, ReturnType<typeof watch>>()

function indexFile(volume: VolumeConfig, filePath: string) {
	const db = getDb()
	const relPath = path.relative(volume.path, filePath)
	const name = path.basename(filePath)
	const ext = path.extname(filePath).slice(1).toLowerCase() || null

	try {
		const stat = fs.statSync(filePath)
		const mimeType = stat.isDirectory() ? null : mime.lookup(name) || null

		db.prepare(
			`INSERT OR REPLACE INTO file_index (volume, path, name, extension, size, mime_type, is_directory, modified_at, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
		).run(
			volume.id,
			relPath,
			name,
			ext,
			stat.size,
			mimeType,
			stat.isDirectory() ? 1 : 0,
			stat.mtime.toISOString(),
		)
	} catch {
		// File may have been deleted between event and indexing
	}
}

function removeFromIndex(volume: VolumeConfig, filePath: string) {
	const db = getDb()
	const relPath = path.relative(volume.path, filePath)
	db.prepare('DELETE FROM file_index WHERE volume = ? AND path = ?').run(volume.id, relPath)
	db.prepare('DELETE FROM file_index WHERE volume = ? AND path LIKE ?').run(
		volume.id,
		`${relPath}/%`,
	)
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve))

export async function scanVolume(volume: VolumeConfig) {
	console.log(`Indexing volume: ${volume.id} (${volume.path})`)
	const db = getDb()

	db.prepare('DELETE FROM file_index WHERE volume = ?').run(volume.id)

	let count = 0

	const walk = async (dir: string, depth: number) => {
		if (depth > 10) return // Limit depth for safety
		try {
			const entries = await fsp.readdir(dir, { withFileTypes: true })
			for (const entry of entries) {
				if (entry.name.startsWith('.')) continue
				if (entry.name === 'node_modules' || entry.name === 'Library') continue
				if (!entry.isFile() && !entry.isDirectory()) continue
				const fullPath = path.join(dir, entry.name)
				indexFile(volume, fullPath)
				count++

				// Yield every 100 files to keep event loop responsive
				if (count % 100 === 0) {
					await yieldToEventLoop()
				}

				if (entry.isDirectory()) {
					await walk(fullPath, depth + 1)
				}
			}
		} catch {
			// Permission errors etc
		}
	}

	await walk(volume.path, 0)
	console.log(`Indexing complete: ${volume.id} (${count} entries)`)
}

export function watchVolume(volume: VolumeConfig) {
	if (watchers.has(volume.id)) return

	try {
		fs.accessSync(volume.path)
	} catch {
		console.warn(`Volume ${volume.id} not accessible at ${volume.path}, skipping watcher`)
		return
	}

	const watcher = watch(volume.path, {
		ignored: [/(^|[/\\])\.|node_modules|Library|\.sock$|\.lock$/],
		persistent: true,
		ignoreInitial: true,
		depth: 5,
	})

	watcher
		.on('add', (p) => indexFile(volume, p))
		.on('addDir', (p) => indexFile(volume, p))
		.on('change', (p) => indexFile(volume, p))
		.on('unlink', (p) => removeFromIndex(volume, p))
		.on('unlinkDir', (p) => removeFromIndex(volume, p))
		.on('error', (err) => {
			console.warn(`Watcher error on ${volume.id}:`, err)
		})

	watchers.set(volume.id, watcher)
	console.log(`Watching volume: ${volume.id}`)
}

export function unwatchVolume(volumeId: string) {
	const watcher = watchers.get(volumeId)
	if (watcher) {
		watcher.close()
		watchers.delete(volumeId)
	}
	const db = getDb()
	db.prepare('DELETE FROM file_index WHERE volume = ?').run(volumeId)
	console.log(`Unwatched and de-indexed volume: ${volumeId}`)
}

export function startWatchers() {
	for (const volume of getVolumes()) {
		watchVolume(volume)
	}
}

export function stopWatchers() {
	for (const w of watchers.values()) {
		w.close()
	}
	watchers.clear()
}

export function searchFiles(query: string, volumeId?: string) {
	const db = getDb()
	const searchTerm = `%${query}%`

	if (volumeId) {
		return db
			.prepare(
				'SELECT * FROM file_index WHERE volume = ? AND name LIKE ? ORDER BY is_directory DESC, name ASC LIMIT 50',
			)
			.all(volumeId, searchTerm)
	}

	return db
		.prepare(
			'SELECT * FROM file_index WHERE name LIKE ? ORDER BY is_directory DESC, name ASC LIMIT 50',
		)
		.all(searchTerm)
}

export function searchFilesInVolumes(query: string, volumeIds: string[]) {
	const db = getDb()
	if (volumeIds.length === 0) return []

	const searchTerm = `%${query}%`
	const placeholders = volumeIds.map(() => '?').join(',')
	return db
		.prepare(
			`SELECT * FROM file_index WHERE volume IN (${placeholders}) AND name LIKE ? ORDER BY is_directory DESC, name ASC LIMIT 50`,
		)
		.all(...volumeIds, searchTerm)
}
