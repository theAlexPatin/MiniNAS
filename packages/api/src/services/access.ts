import { getDb } from '../db/index.js'

export interface UserInfo {
	id: string
	username: string
	role: string
	created_at: string
}

export function getUserById(userId: string): UserInfo | null {
	const db = getDb()
	return (
		(db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(userId) as
			| UserInfo
			| undefined) ?? null
	)
}

export function isAdmin(userId: string): boolean {
	const db = getDb()
	const row = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as
		| { role: string }
		| undefined
	return row?.role === 'admin'
}

export function canAccessVolume(userId: string, volumeId: string): boolean {
	if (isAdmin(userId)) return true

	const db = getDb()
	const volume = db.prepare('SELECT visibility FROM volumes WHERE id = ?').get(volumeId) as
		| { visibility: string }
		| undefined

	if (!volume) return false
	if (volume.visibility === 'public') return true

	// Private volume — check access list
	const access = db
		.prepare('SELECT 1 FROM volume_access WHERE volume_id = ? AND user_id = ?')
		.get(volumeId, userId)
	return !!access
}

export function getAccessibleVolumeIds(userId: string): string[] {
	const db = getDb()

	if (isAdmin(userId)) {
		const rows = db.prepare('SELECT id FROM volumes').all() as { id: string }[]
		return rows.map((r) => r.id)
	}

	// Public volumes + private volumes the user has been granted access to
	const rows = db
		.prepare(
			`SELECT id FROM volumes WHERE visibility = 'public'
       UNION
       SELECT volume_id AS id FROM volume_access WHERE user_id = ?`,
		)
		.all(userId) as { id: string }[]
	return rows.map((r) => r.id)
}

export function grantVolumeAccess(volumeId: string, userId: string): void {
	const db = getDb()
	db.prepare('INSERT OR IGNORE INTO volume_access (volume_id, user_id) VALUES (?, ?)').run(
		volumeId,
		userId,
	)
}

export function revokeVolumeAccess(volumeId: string, userId: string): void {
	const db = getDb()
	db.prepare('DELETE FROM volume_access WHERE volume_id = ? AND user_id = ?').run(volumeId, userId)
}

export function getVolumeAccessList(volumeId: string): UserInfo[] {
	const db = getDb()
	return db
		.prepare(
			`SELECT u.id, u.username, u.role, u.created_at
       FROM volume_access va
       JOIN users u ON u.id = va.user_id
       WHERE va.volume_id = ?
       ORDER BY u.username`,
		)
		.all(volumeId) as UserInfo[]
}

export function setVolumeVisibility(volumeId: string, visibility: 'public' | 'private'): void {
	const db = getDb()
	db.prepare('UPDATE volumes SET visibility = ? WHERE id = ?').run(visibility, volumeId)
	if (visibility === 'public') {
		db.prepare('DELETE FROM volume_access WHERE volume_id = ?').run(volumeId)
	}
}

export function listUsers(): UserInfo[] {
	const db = getDb()
	return db
		.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at')
		.all() as UserInfo[]
}

export function resetPasskeys(userId: string): number {
	const db = getDb()
	const user = getUserById(userId)
	if (!user) return 0

	const result = db.prepare('DELETE FROM credentials WHERE user_id = ?').run(userId)
	// Also clear active sessions so they have to re-authenticate
	db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
	return result.changes
}

export function deleteUser(userId: string): boolean {
	const db = getDb()
	// Don't allow deleting admin users
	const user = getUserById(userId)
	if (!user || user.role === 'admin') return false

	const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId)
	return result.changes > 0
}
