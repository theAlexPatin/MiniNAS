import crypto from 'node:crypto'
import { nanoid } from 'nanoid'
import { getDb } from '../db/index.js'

interface WebDAVToken {
	id: string
	user_id: string
	label: string
	token_hash: string
	created_at: string
	last_used_at: string | null
}

function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex')
}

export function createToken(userId: string, label: string): { id: string; token: string } {
	const db = getDb()
	const id = nanoid(12)
	const raw = crypto.randomBytes(32).toString('base64url')
	const hash = hashToken(raw)

	db.prepare(`INSERT INTO webdav_tokens (id, user_id, label, token_hash) VALUES (?, ?, ?, ?)`).run(
		id,
		userId,
		label,
		hash,
	)

	return { id, token: raw }
}

export function verifyToken(username: string, rawToken: string): { userId: string } | null {
	const db = getDb()
	const hash = hashToken(rawToken)

	const row = db
		.prepare(
			`SELECT wt.id, wt.user_id FROM webdav_tokens wt
       JOIN users u ON u.id = wt.user_id
       WHERE u.username = ? AND wt.token_hash = ?`,
		)
		.get(username, hash) as { id: string; user_id: string } | undefined

	if (!row) return null

	db.prepare(`UPDATE webdav_tokens SET last_used_at = datetime('now') WHERE id = ?`).run(row.id)

	return { userId: row.user_id }
}

export function listTokens(userId: string): Omit<WebDAVToken, 'token_hash'>[] {
	const db = getDb()
	return db
		.prepare(
			`SELECT id, user_id, label, created_at, last_used_at
       FROM webdav_tokens WHERE user_id = ? ORDER BY created_at DESC`,
		)
		.all(userId) as Omit<WebDAVToken, 'token_hash'>[]
}

export function revokeToken(tokenId: string, userId: string): boolean {
	const db = getDb()
	const result = db
		.prepare(`DELETE FROM webdav_tokens WHERE id = ? AND user_id = ?`)
		.run(tokenId, userId)
	return result.changes > 0
}
