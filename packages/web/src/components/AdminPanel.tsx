import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	ArrowLeft,
	Check,
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	HardDrive,
	KeyRound,
	Loader2,
	Mail,
	Plus,
	Shield,
	Trash2,
	UserPlus,
	Users,
	X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
	useAddVolume,
	useAdminInvites,
	useAdminUsers,
	useAdminVolumes,
	useAvailableVolumes,
	useCreateInvite,
	useDeleteInvite,
	useDeleteUser,
	useGrantVolumeAccess,
	useRemoveVolume,
	useResetPasskeys,
	useRevokeVolumeAccess,
	useSetVolumeVisibility,
	useVolumeAccess,
} from '../hooks/useAdmin'
import { useAuth } from '../hooks/useAuth'
import type { AdminVolume } from '../lib/api'
import { withBase } from '../lib/basePath'
import UpdateSection from './UpdateSection'

const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function formatDate(dateStr: string | null): string {
	if (!dateStr) return 'Never'
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function getInviteStatus(invite: {
	used_at: string | null
	expires_at: string
}): 'used' | 'expired' | 'pending' {
	if (invite.used_at) return 'used'
	if (new Date(invite.expires_at) < new Date()) return 'expired'
	return 'pending'
}

// --- Volume Access Sub-component ---

function VolumeAccessPanel({
	volumeId,
	allUsers,
}: {
	volumeId: string
	allUsers: { id: string; username: string; role?: string }[]
}) {
	const { data, isLoading } = useVolumeAccess(volumeId)
	const grantMutation = useGrantVolumeAccess()
	const revokeMutation = useRevokeVolumeAccess()
	const [selectedUserId, setSelectedUserId] = useState('')

	const accessUserIds = new Set(data?.users?.map((u) => u.id) || [])
	const nonAdminUsers = allUsers.filter((u) => u.role !== 'admin')
	const availableUsers = nonAdminUsers.filter((u) => !accessUserIds.has(u.id))

	const handleGrant = () => {
		if (!selectedUserId) return
		grantMutation.mutate({ volumeId, userId: selectedUserId })
		setSelectedUserId('')
	}

	return (
		<div className="mt-3 pl-4 border-l-2 border-gray-100">
			<p className="text-xs font-medium text-gray-500 mb-2">Access List</p>
			{isLoading ? (
				<Loader2 size={14} className="animate-spin text-gray-400" />
			) : !data?.users?.length ? (
				<p className="text-xs text-gray-400 mb-2">No users have explicit access.</p>
			) : (
				<div className="space-y-1 mb-2">
					{data.users.map((u) => (
						<div key={u.id} className="flex items-center justify-between text-sm">
							<span className="text-gray-700">{u.username}</span>
							<button
								type="button"
								onClick={() => revokeMutation.mutate({ volumeId, userId: u.id })}
								disabled={revokeMutation.isPending}
								className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
								title="Revoke access"
							>
								<Trash2 size={14} />
							</button>
						</div>
					))}
				</div>
			)}
			{availableUsers.length > 0 && (
				<div className="flex gap-2 mt-2">
					<select
						value={selectedUserId}
						onChange={(e) => setSelectedUserId(e.target.value)}
						className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
					>
						<option value="">Select user...</option>
						{availableUsers.map((u) => (
							<option key={u.id} value={u.id}>
								{u.username}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={handleGrant}
						disabled={!selectedUserId || grantMutation.isPending}
						className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50"
					>
						<UserPlus size={12} />
						Grant
					</button>
				</div>
			)}
		</div>
	)
}

// --- Add Volume Modal ---

function labelToId(label: string): string {
	return label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

function AddVolumeModal({
	onClose,
	addMutation,
}: {
	onClose: () => void
	addMutation: ReturnType<typeof useAddVolume>
}) {
	const { data, isLoading } = useAvailableVolumes(true)
	const [selectedPath, setSelectedPath] = useState<string | null>(null)
	const [selectedName, setSelectedName] = useState('')
	const [label, setLabel] = useState('')
	const [customId, setCustomId] = useState('')
	const [useCustomId, setUseCustomId] = useState(false)

	const inferredId = labelToId(label)
	const finalId = useCustomId ? customId.trim() : inferredId

	const handleSelect = (vol: { name: string; path: string }) => {
		setSelectedPath(vol.path)
		setSelectedName(vol.name)
		setLabel(vol.name)
		setCustomId('')
		setUseCustomId(false)
	}

	const handleSubmit = async () => {
		if (!selectedPath || !label.trim() || !finalId) return
		await addMutation.mutateAsync({
			id: finalId,
			label: label.trim(),
			path: selectedPath,
		})
		onClose()
	}

	const handleEscape = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		},
		[onClose],
	)

	useEffect(() => {
		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [handleEscape])

	return (
		<div
			className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
			onClick={onClose}
		>
			<div
				className="bg-white border border-gray-200 rounded-lg max-w-md w-full shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
					<h3 className="text-base font-semibold text-gray-900">Add Volume</h3>
					<button
						type="button"
						onClick={onClose}
						className="p-1 hover:bg-gray-100 rounded transition-colors"
					>
						<X size={18} className="text-gray-400" />
					</button>
				</div>

				{/* Body */}
				<div className="px-5 py-4 space-y-4">
					{/* Step 1: Select a volume */}
					<div>
						<p className="text-sm font-medium text-gray-700 mb-2">Select a volume</p>
						{isLoading ? (
							<div className="flex justify-center py-6">
								<Loader2 size={18} className="animate-spin text-gray-400" />
							</div>
						) : !data?.volumes?.length ? (
							<p className="text-sm text-gray-400 py-4 text-center">No available volumes found.</p>
						) : (
							<div className="space-y-1 max-h-48 overflow-y-auto">
								{data.volumes.map((vol) => (
									<button
										key={vol.path}
										type="button"
										onClick={() => handleSelect(vol)}
										className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
											selectedPath === vol.path
												? 'bg-brand-50 border border-brand-200'
												: 'hover:bg-gray-50 border border-transparent'
										}`}
									>
										<HardDrive
											size={16}
											className={selectedPath === vol.path ? 'text-brand-600' : 'text-gray-400'}
										/>
										<div className="min-w-0 flex-1">
											<p
												className={`text-sm font-medium ${selectedPath === vol.path ? 'text-brand-700' : 'text-gray-800'}`}
											>
												{vol.name}
											</p>
											<p className="text-xs text-gray-400 font-mono truncate">{vol.path}</p>
										</div>
										{selectedPath === vol.path && (
											<Check size={16} className="text-brand-600 shrink-0" />
										)}
									</button>
								))}
							</div>
						)}
					</div>

					{/* Step 2: Label & ID (shown after selection) */}
					{selectedPath && (
						<div className="space-y-3 pt-2 border-t border-gray-100">
							<div>
								<label htmlFor="vol-label" className="block text-sm font-medium text-gray-700 mb-1">
									Label
								</label>
								<input
									id="vol-label"
									type="text"
									value={label}
									onChange={(e) => setLabel(e.target.value)}
									placeholder={selectedName}
									className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
								/>
							</div>

							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setUseCustomId(!useCustomId)}
									className={`relative w-8 h-[18px] rounded-full transition-colors ${useCustomId ? 'bg-brand-600' : 'bg-gray-300'}`}
								>
									<span
										className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${useCustomId ? 'translate-x-[14px]' : ''}`}
									/>
								</button>
								<span className="text-sm text-gray-600">Set custom ID</span>
							</div>

							{useCustomId ? (
								<div>
									<input
										type="text"
										value={customId}
										onChange={(e) => setCustomId(e.target.value)}
										placeholder="custom-id"
										className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
									/>
								</div>
							) : (
								inferredId && (
									<p className="text-xs text-gray-400">
										ID: <span className="font-mono">{inferredId}</span>
									</p>
								)
							)}
						</div>
					)}

					{addMutation.isError && (
						<p className="text-sm text-red-600">{(addMutation.error as Error).message}</p>
					)}
				</div>

				{/* Footer */}
				<div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
					<button
						type="button"
						onClick={onClose}
						className="px-3 py-1.5 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!selectedPath || !label.trim() || !finalId || addMutation.isPending}
						className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{addMutation.isPending ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<Plus size={16} />
						)}
						Add Volume
					</button>
				</div>
			</div>
		</div>
	)
}

// --- Volumes Section ---

function VolumesSection() {
	const { data, isLoading } = useAdminVolumes()
	const addMutation = useAddVolume()
	const removeMutation = useRemoveVolume()
	const visibilityMutation = useSetVolumeVisibility()
	const { data: usersData } = useAdminUsers()
	const [expandedVolume, setExpandedVolume] = useState<string | null>(null)
	const [showAddModal, setShowAddModal] = useState(false)

	const handleRemove = (vol: AdminVolume) => {
		if (
			confirm(
				`Remove volume "${vol.label}" (${vol.id})? This only removes it from MiniNAS — files on disk are not deleted.`,
			)
		) {
			removeMutation.mutate(vol.id)
		}
	}

	const toggleVisibility = (vol: AdminVolume) => {
		const next = vol.visibility === 'public' ? 'private' : 'public'
		visibilityMutation.mutate({ id: vol.id, visibility: next })
	}

	return (
		<div className="bg-white border border-gray-200 rounded-lg shadow-sm">
			<div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<HardDrive size={16} className="text-gray-700" />
					<h2 className="text-sm font-semibold text-gray-900">Volumes</h2>
				</div>
				<button
					type="button"
					onClick={() => setShowAddModal(true)}
					className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-brand-600 hover:bg-brand-700 text-white transition-colors"
				>
					<Plus size={14} />
					Add Volume
				</button>
			</div>

			{showAddModal && (
				<AddVolumeModal onClose={() => setShowAddModal(false)} addMutation={addMutation} />
			)}

			{/* Volume List */}
			{isLoading ? (
				<div className="flex justify-center py-8">
					<Loader2 size={20} className="animate-spin text-gray-400" />
				</div>
			) : !data?.volumes?.length ? (
				<div className="text-center py-8 text-sm text-gray-400">No volumes configured.</div>
			) : (
				<div className="divide-y divide-gray-100">
					{data.volumes.map((vol) => (
						<div key={vol.id} className="px-5 py-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3 min-w-0">
									<button
										type="button"
										onClick={() => setExpandedVolume(expandedVolume === vol.id ? null : vol.id)}
										className="p-0.5 text-gray-400 hover:text-gray-600"
									>
										{expandedVolume === vol.id ? (
											<ChevronDown size={14} />
										) : (
											<ChevronRight size={14} />
										)}
									</button>
									<div className="min-w-0">
										<p className="text-sm font-medium text-gray-800">{vol.label}</p>
										<p className="text-xs text-gray-400 font-mono truncate">
											{vol.id} &middot; {vol.path}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<button
										type="button"
										onClick={() => toggleVisibility(vol)}
										disabled={visibilityMutation.isPending}
										className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
											vol.visibility === 'public'
												? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
												: 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
										}`}
										title={`Click to make ${vol.visibility === 'public' ? 'private' : 'public'}`}
									>
										{vol.visibility === 'public' ? <Eye size={12} /> : <EyeOff size={12} />}
										{vol.visibility}
									</button>
									<button
										type="button"
										onClick={() => handleRemove(vol)}
										disabled={removeMutation.isPending}
										className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
										title="Remove volume"
									>
										<Trash2 size={16} />
									</button>
								</div>
							</div>
							{expandedVolume === vol.id && vol.visibility === 'public' && (
								<div className="mt-3 pl-4 border-l-2 border-gray-100">
									<p className="text-xs text-gray-400">
										Public volumes are accessible to all users — no access list needed.
									</p>
								</div>
							)}
							{expandedVolume === vol.id && vol.visibility === 'private' && (
								<VolumeAccessPanel
									volumeId={vol.id}
									allUsers={(usersData?.users || []).map((u) => ({
										id: u.id,
										username: u.username,
										role: u.role,
									}))}
								/>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

// --- Users Section ---

function UsersSection() {
	const { data, isLoading } = useAdminUsers()
	const deleteMutation = useDeleteUser()
	const resetMutation = useResetPasskeys()

	const handleDelete = (user: { id: string; username: string }) => {
		if (confirm(`Delete user "${user.username}"? This cannot be undone.`)) {
			deleteMutation.mutate(user.id)
		}
	}

	const handleResetPasskeys = (user: { id: string; username: string }) => {
		if (confirm(`Reset all passkeys for "${user.username}"? They will need to re-register.`)) {
			resetMutation.mutate(user.id)
		}
	}

	return (
		<div className="bg-white border border-gray-200 rounded-lg shadow-sm">
			<div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
				<Users size={16} className="text-gray-700" />
				<h2 className="text-sm font-semibold text-gray-900">Users</h2>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-8">
					<Loader2 size={20} className="animate-spin text-gray-400" />
				</div>
			) : !data?.users?.length ? (
				<div className="text-center py-8 text-sm text-gray-400">No users found.</div>
			) : (
				<div className="divide-y divide-gray-100">
					{data.users.map((user) => (
						<div key={user.id} className="flex items-center justify-between px-5 py-3">
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<p className="text-sm font-medium text-gray-800">{user.username}</p>
									{user.role === 'admin' && (
										<span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 font-medium">
											admin
										</span>
									)}
								</div>
								<p className="text-xs text-gray-400">Created {formatDate(user.created_at)}</p>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<button
									type="button"
									onClick={() => handleResetPasskeys(user)}
									disabled={resetMutation.isPending}
									className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
									title="Reset passkeys"
								>
									<KeyRound size={12} />
									Reset Passkeys
								</button>
								<button
									type="button"
									onClick={() => handleDelete(user)}
									disabled={user.role === 'admin' || deleteMutation.isPending}
									className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
									title={user.role === 'admin' ? 'Cannot delete admin user' : 'Delete user'}
								>
									<Trash2 size={16} />
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{(deleteMutation.isError || resetMutation.isError) && (
				<div className="px-5 py-2 border-t border-gray-100">
					<p className="text-sm text-red-600">
						{((deleteMutation.error || resetMutation.error) as Error)?.message}
					</p>
				</div>
			)}
		</div>
	)
}

// --- Invites Section ---

function InvitesSection() {
	const { data, isLoading } = useAdminInvites()
	const createMutation = useCreateInvite()
	const deleteMutation = useDeleteInvite()

	const [username, setUsername] = useState('')
	const [expiresInHours, setExpiresInHours] = useState('24')

	const handleCreate = async () => {
		if (!username.trim()) return
		const hours = parseInt(expiresInHours, 10)
		await createMutation.mutateAsync({
			username: username.trim(),
			expiresInHours: isNaN(hours) ? undefined : hours,
		})
		setUsername('')
	}

	const handleDelete = (id: string) => {
		if (confirm('Delete this invite?')) {
			deleteMutation.mutate(id)
		}
	}

	const statusBadge = (status: 'pending' | 'used' | 'expired') => {
		const styles = {
			pending: 'bg-blue-100 text-blue-700',
			used: 'bg-emerald-100 text-emerald-700',
			expired: 'bg-gray-100 text-gray-500',
		}
		return (
			<span className={`px-1.5 py-0.5 text-xs rounded font-medium ${styles[status]}`}>
				{status}
			</span>
		)
	}

	return (
		<div className="bg-white border border-gray-200 rounded-lg shadow-sm">
			<div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
				<Mail size={16} className="text-gray-700" />
				<h2 className="text-sm font-semibold text-gray-900">Invites</h2>
			</div>

			{/* Create Invite Form */}
			<div className="px-5 py-3 border-b border-gray-100">
				<div className="flex gap-2">
					<input
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
						placeholder="Username for invite"
						className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
					/>
					<select
						value={expiresInHours}
						onChange={(e) => setExpiresInHours(e.target.value)}
						className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
					>
						<option value="1">1 hour</option>
						<option value="24">24 hours</option>
						<option value="72">3 days</option>
						<option value="168">7 days</option>
					</select>
					<button
						type="button"
						onClick={handleCreate}
						disabled={!username.trim() || createMutation.isPending}
						className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{createMutation.isPending ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<Plus size={16} />
						)}
						Create
					</button>
				</div>
				{createMutation.isError && (
					<p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>
				)}
			</div>

			{/* Invite List */}
			{isLoading ? (
				<div className="flex justify-center py-8">
					<Loader2 size={20} className="animate-spin text-gray-400" />
				</div>
			) : !data?.invites?.length ? (
				<div className="text-center py-8 text-sm text-gray-400">No invites yet.</div>
			) : (
				<div className="divide-y divide-gray-100">
					{data.invites.map((invite) => {
						const status = getInviteStatus(invite)
						return (
							<div key={invite.id} className="flex items-center justify-between px-5 py-3">
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium text-gray-800">{invite.username}</p>
										{statusBadge(status)}
									</div>
									<p className="text-xs text-gray-400">
										Expires {formatDate(invite.expires_at)}
										{invite.used_at && ` · Used ${formatDate(invite.used_at)}`}
									</p>
								</div>
								<button
									type="button"
									onClick={() => handleDelete(invite.id)}
									disabled={deleteMutation.isPending}
									className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
									title="Delete invite"
								>
									<Trash2 size={16} />
								</button>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}

// --- Main Admin Panel ---

function AdminPanelInner() {
	const { isAuthenticated, isLoading: authLoading, user } = useAuth()

	if (authLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 size={32} className="animate-spin text-gray-400" />
			</div>
		)
	}

	if (!isAuthenticated) {
		if (typeof window !== 'undefined') window.location.href = withBase('/login')
		return null
	}

	if (user?.role !== 'admin') {
		if (typeof window !== 'undefined') window.location.href = withBase('/')
		return null
	}

	return (
		<div className="max-w-3xl mx-auto px-4 py-6">
			{/* Header */}
			<div className="flex items-center gap-3 mb-8">
				<a
					href={withBase('/')}
					className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
					title="Back to files"
				>
					<ArrowLeft size={18} />
				</a>
				<div className="flex items-center gap-2.5">
					<Shield size={22} className="text-gray-700" />
					<h1 className="text-xl font-semibold text-gray-900">Admin</h1>
				</div>
			</div>

			<div className="space-y-6">
				<VolumesSection />
				<UsersSection />
				<InvitesSection />
				<UpdateSection />
			</div>
		</div>
	)
}

export default function AdminPanel() {
	return (
		<QueryClientProvider client={queryClient}>
			<AdminPanelInner />
		</QueryClientProvider>
	)
}
