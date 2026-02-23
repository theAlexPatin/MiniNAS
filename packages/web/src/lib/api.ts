import { withBase } from './basePath'

const API_BASE = withBase('/api/v1')

/** Encode each segment of a file path for use in URLs */
function encodePath(filePath: string): string {
	if (!filePath) return ''
	return filePath.split('/').map(encodeURIComponent).join('/')
}

/** Build a /<prefix>/<volume>[/<path>] URL, avoiding trailing slashes */
function volumeUrl(prefix: string, volume: string, filePath: string = ''): string {
	const encoded = encodePath(filePath)
	return encoded
		? `/${prefix}/${encodeURIComponent(volume)}/${encoded}`
		: `/${prefix}/${encodeURIComponent(volume)}`
}

class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message)
		this.name = 'ApiError'
	}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		credentials: 'include',
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options?.headers,
		},
	})

	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }))
		throw new ApiError(res.status, body.error || res.statusText)
	}

	return res.json()
}

export interface FileEntry {
	name: string
	path: string
	isDirectory: boolean
	size: number
	modifiedAt: string
	mimeType: string | null
	hasThumbnail?: boolean
}

export interface DirectoryListing {
	entries: FileEntry[]
	path: string
	volume: string
}

export interface VolumeInfo {
	id: string
	label: string
	totalBytes: number
	freeBytes: number
	usedBytes: number
}

export interface WebDAVToken {
	id: string
	user_id: string
	label: string
	created_at: string
	last_used_at: string | null
}

export interface AdminVolume {
	id: string
	label: string
	path: string
	visibility: 'public' | 'private'
}

export interface AdminUser {
	id: string
	username: string
	role: string
	created_at: string
}

export interface AdminInvite {
	id: string
	username: string
	created_by: string
	created_at: string
	expires_at: string
	used_at: string | null
	used_by: string | null
}

export interface VolumeAccessUser {
	id: string
	username: string
}

export const api = {
	listFiles(volume: string, path: string = ''): Promise<DirectoryListing> {
		return request(volumeUrl('files', volume, path))
	},

	deleteFile(volume: string, path: string): Promise<{ ok: boolean }> {
		return request(volumeUrl('files', volume, path), { method: 'DELETE' })
	},

	moveFile(volume: string, path: string, destination: string): Promise<{ ok: boolean }> {
		return request(volumeUrl('files', volume, path), {
			method: 'PATCH',
			body: JSON.stringify({ destination }),
		})
	},

	createDirectory(volume: string, parentPath: string, name: string): Promise<{ ok: boolean }> {
		return request(volumeUrl('files', volume, parentPath), {
			method: 'POST',
			body: JSON.stringify({ name }),
		})
	},

	getVolumes(): Promise<{ volumes: VolumeInfo[] }> {
		return request('/volumes')
	},

	getDownloadUrl(volume: string, path: string): string {
		return `${API_BASE}${volumeUrl('download', volume, path)}`
	},

	createWebDAVToken(label: string): Promise<{ id: string; label: string; token: string }> {
		return request('/webdav-tokens', {
			method: 'POST',
			body: JSON.stringify({ label }),
		})
	},

	listWebDAVTokens(): Promise<{
		tokens: WebDAVToken[]
	}> {
		return request('/webdav-tokens')
	},

	revokeWebDAVToken(id: string): Promise<{ ok: boolean }> {
		return request(`/webdav-tokens/${id}`, { method: 'DELETE' })
	},

	getVersion(): Promise<{ version: string }> {
		return request('/admin/version')
	},

	triggerUpdate(): Promise<{ ok: boolean; message: string }> {
		return request('/admin/update', { method: 'POST' })
	},

	// --- Admin: Volumes ---

	adminListVolumes(): Promise<{ volumes: AdminVolume[] }> {
		return request('/admin/volumes')
	},

	adminAddVolume(id: string, label: string, path: string): Promise<{ ok: boolean; id: string }> {
		return request('/admin/volumes', {
			method: 'POST',
			body: JSON.stringify({ id, label, path }),
		})
	},

	adminRemoveVolume(id: string): Promise<{ ok: boolean }> {
		return request(`/admin/volumes/${encodeURIComponent(id)}`, { method: 'DELETE' })
	},

	adminSetVolumeVisibility(id: string, visibility: 'public' | 'private'): Promise<{ ok: boolean }> {
		return request(`/admin/volumes/${encodeURIComponent(id)}/visibility`, {
			method: 'PATCH',
			body: JSON.stringify({ visibility }),
		})
	},

	adminGetVolumeAccess(volumeId: string): Promise<{ users: VolumeAccessUser[] }> {
		return request(`/admin/volumes/${encodeURIComponent(volumeId)}/access`)
	},

	adminGrantVolumeAccess(volumeId: string, userId: string): Promise<{ ok: boolean }> {
		return request(`/admin/volumes/${encodeURIComponent(volumeId)}/access`, {
			method: 'POST',
			body: JSON.stringify({ userId }),
		})
	},

	adminRevokeVolumeAccess(volumeId: string, userId: string): Promise<{ ok: boolean }> {
		return request(
			`/admin/volumes/${encodeURIComponent(volumeId)}/access/${encodeURIComponent(userId)}`,
			{
				method: 'DELETE',
			},
		)
	},

	// --- Admin: Users ---

	adminListUsers(): Promise<{ users: AdminUser[] }> {
		return request('/admin/users')
	},

	adminDeleteUser(id: string): Promise<{ ok: boolean }> {
		return request(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
	},

	adminResetPasskeys(
		userId: string,
	): Promise<{ ok: boolean; username: string; removedCredentials: number }> {
		return request(`/admin/users/${encodeURIComponent(userId)}/reset-passkeys`, { method: 'POST' })
	},

	// --- Admin: Invites ---

	adminListInvites(): Promise<{ invites: AdminInvite[] }> {
		return request('/admin/invites')
	},

	adminCreateInvite(username: string, expiresInHours?: number): Promise<{ invite: AdminInvite }> {
		return request('/admin/invites', {
			method: 'POST',
			body: JSON.stringify({ username, expiresInHours }),
		})
	},

	adminDeleteInvite(id: string): Promise<{ ok: boolean }> {
		return request(`/admin/invites/${encodeURIComponent(id)}`, { method: 'DELETE' })
	},
}
