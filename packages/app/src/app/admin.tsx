import { useRouter } from 'expo-router'
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
} from 'lucide-react-native'
import { useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import UpdateSection from '@/components/UpdateSection'
import Badge from '@/components/ui/Badge'
import Tabs from '@/components/ui/Tabs'
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
} from '@/hooks/useAdmin'
import { useAuth } from '@/hooks/useAuth'
import type { AdminVolume } from '@/lib/api'
import { APP_NAME } from '@/lib/config'
import { formatDate } from '@/lib/format'
import { Colors, Outlines, Typography } from '@/theme'

// --- Volume Access ---
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

	return (
		<View style={styles.accessPanel}>
			<Text style={styles.accessTitle}>Access List</Text>
			{isLoading ? (
				<ActivityIndicator size="small" color={Colors.TextColor.tertiary} />
			) : !data?.users?.length ? (
				<Text style={styles.emptyText}>No users have explicit access.</Text>
			) : (
				data.users.map((u) => (
					<View key={u.id} style={styles.accessRow}>
						<Text style={styles.accessUsername}>{u.username}</Text>
						<Pressable onPress={() => revokeMutation.mutate({ volumeId, userId: u.id })}>
							<Trash2 size={14} color={Colors.TextColor.tertiary} />
						</Pressable>
					</View>
				))
			)}
		</View>
	)
}

// --- Volumes ---
function VolumesSection() {
	const { data, isLoading } = useAdminVolumes()
	const removeMutation = useRemoveVolume()
	const visibilityMutation = useSetVolumeVisibility()
	const { data: usersData } = useAdminUsers()
	const [expandedVolume, setExpandedVolume] = useState<string | null>(null)

	const handleRemove = (vol: AdminVolume) => {
		Alert.alert('Remove Volume', `Remove "${vol.label}"? Files on disk won't be deleted.`, [
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(vol.id) },
		])
	}

	const toggleVisibility = (vol: AdminVolume) => {
		const next = vol.visibility === 'public' ? 'private' : 'public'
		visibilityMutation.mutate({ id: vol.id, visibility: next })
	}

	return (
		<View style={styles.card}>
			<View style={styles.cardHeader}>
				<View style={styles.cardTitleRow}>
					<HardDrive size={16} color={Colors.TextColor.primary} />
					<Text style={styles.cardTitle}>Volumes</Text>
				</View>
			</View>

			{isLoading ? (
				<ActivityIndicator size="small" style={{ padding: 32 }} color={Colors.TextColor.tertiary} />
			) : !data?.volumes?.length ? (
				<Text style={styles.emptyCenter}>No volumes configured.</Text>
			) : (
				data.volumes.map((vol) => (
					<View key={vol.id} style={styles.volumeRow}>
						<View style={styles.volumeInfo}>
							<Pressable
								onPress={() => setExpandedVolume(expandedVolume === vol.id ? null : vol.id)}
							>
								{expandedVolume === vol.id ? (
									<ChevronDown size={14} color={Colors.TextColor.tertiary} />
								) : (
									<ChevronRight size={14} color={Colors.TextColor.tertiary} />
								)}
							</Pressable>
							<View style={{ flex: 1 }}>
								<Text style={styles.volLabel}>{vol.label}</Text>
								<Text style={styles.volPath}>
									{vol.id} · {vol.path}
								</Text>
							</View>
							<Pressable
								onPress={() => toggleVisibility(vol)}
								style={[
									styles.visBadge,
									vol.visibility === 'public' ? styles.visBadgePublic : styles.visBadgePrivate,
								]}
							>
								{vol.visibility === 'public' ? (
									<Eye size={12} color="#047857" />
								) : (
									<EyeOff size={12} color={Colors.TextColor.secondary} />
								)}
								<Text
									style={vol.visibility === 'public' ? styles.visTextPublic : styles.visTextPrivate}
								>
									{vol.visibility}
								</Text>
							</Pressable>
							<Pressable onPress={() => handleRemove(vol)} style={styles.deleteBtn}>
								<Trash2 size={16} color={Colors.TextColor.tertiary} />
							</Pressable>
						</View>
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
						{expandedVolume === vol.id && vol.visibility === 'public' && (
							<View style={styles.accessPanel}>
								<Text style={styles.emptyText}>Public volumes are accessible to all users.</Text>
							</View>
						)}
					</View>
				))
			)}
		</View>
	)
}

// --- Users ---
function UsersSection() {
	const { data, isLoading } = useAdminUsers()
	const deleteMutation = useDeleteUser()
	const resetMutation = useResetPasskeys()

	const handleDelete = (user: { id: string; username: string }) => {
		Alert.alert('Delete User', `Delete "${user.username}"? This cannot be undone.`, [
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(user.id) },
		])
	}

	const handleResetPasskeys = (user: { id: string; username: string }) => {
		Alert.alert('Reset Passkeys', `Reset all passkeys for "${user.username}"?`, [
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Reset', onPress: () => resetMutation.mutate(user.id) },
		])
	}

	return (
		<View style={styles.card}>
			<View style={styles.cardHeader}>
				<View style={styles.cardTitleRow}>
					<Users size={16} color={Colors.TextColor.primary} />
					<Text style={styles.cardTitle}>Users</Text>
				</View>
			</View>

			{isLoading ? (
				<ActivityIndicator size="small" style={{ padding: 32 }} color={Colors.TextColor.tertiary} />
			) : !data?.users?.length ? (
				<Text style={styles.emptyCenter}>No users found.</Text>
			) : (
				data.users.map((user) => (
					<View key={user.id} style={styles.userRow}>
						<View style={{ flex: 1 }}>
							<View style={styles.userNameRow}>
								<Text style={styles.userName}>{user.username}</Text>
								{user.role === 'admin' && <Badge variant="warning">admin</Badge>}
							</View>
							<Text style={styles.userMeta}>Created {formatDate(user.created_at)}</Text>
						</View>
						<Pressable onPress={() => handleResetPasskeys(user)} style={styles.resetBtn}>
							<KeyRound size={12} color={Colors.TextColor.secondary} />
							<Text style={styles.resetBtnText}>Reset Passkeys</Text>
						</Pressable>
						<Pressable
							onPress={() => handleDelete(user)}
							disabled={user.role === 'admin'}
							style={[styles.deleteBtn, user.role === 'admin' && { opacity: 0.3 }]}
						>
							<Trash2 size={16} color={Colors.TextColor.tertiary} />
						</Pressable>
					</View>
				))
			)}
		</View>
	)
}

// --- Invites ---
function InvitesSection() {
	const { data, isLoading } = useAdminInvites()
	const createMutation = useCreateInvite()
	const deleteMutation = useDeleteInvite()
	const [username, setUsername] = useState('')

	const handleCreate = async () => {
		if (!username.trim()) return
		await createMutation.mutateAsync({ username: username.trim(), expiresInHours: 24 })
		setUsername('')
	}

	const handleDelete = (id: string) => {
		Alert.alert('Delete Invite', 'Delete this invite?', [
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
		])
	}

	const getStatus = (invite: { used_at: string | null; expires_at: string }) => {
		if (invite.used_at) return 'used'
		if (new Date(invite.expires_at) < new Date()) return 'expired'
		return 'pending'
	}

	return (
		<View style={styles.card}>
			<View style={styles.cardHeader}>
				<View style={styles.cardTitleRow}>
					<Mail size={16} color={Colors.TextColor.primary} />
					<Text style={styles.cardTitle}>Invites</Text>
				</View>
			</View>

			<View style={styles.createForm}>
				<TextInput
					value={username}
					onChangeText={setUsername}
					placeholder="Username for invite"
					placeholderTextColor={Colors.TextColor.tertiary}
					style={styles.formInput}
					onSubmitEditing={handleCreate}
				/>
				<Pressable
					onPress={handleCreate}
					disabled={!username.trim() || createMutation.isPending}
					style={[
						styles.createBtn,
						(!username.trim() || createMutation.isPending) && { opacity: 0.5 },
					]}
				>
					{createMutation.isPending ? (
						<ActivityIndicator size="small" color="#fff" />
					) : (
						<Plus size={16} color="#fff" />
					)}
					<Text style={styles.createBtnText}>Create</Text>
				</Pressable>
			</View>

			{isLoading ? (
				<ActivityIndicator size="small" style={{ padding: 32 }} color={Colors.TextColor.tertiary} />
			) : !data?.invites?.length ? (
				<Text style={styles.emptyCenter}>No invites yet.</Text>
			) : (
				data.invites.map((invite) => {
					const status = getStatus(invite)
					const variantMap = { pending: 'info', used: 'success', expired: 'default' } as const
					return (
						<View key={invite.id} style={styles.userRow}>
							<View style={{ flex: 1 }}>
								<View style={styles.userNameRow}>
									<Text style={styles.userName}>{invite.username}</Text>
									<Badge variant={variantMap[status]}>{status}</Badge>
								</View>
								<Text style={styles.userMeta}>Expires {formatDate(invite.expires_at)}</Text>
							</View>
							<Pressable onPress={() => handleDelete(invite.id)} style={styles.deleteBtn}>
								<Trash2 size={16} color={Colors.TextColor.tertiary} />
							</Pressable>
						</View>
					)
				})
			)}
		</View>
	)
}

// --- Main Admin Screen ---
const adminTabs = [
	{ id: 'storage', label: 'Storage' },
	{ id: 'users', label: 'Users' },
	{ id: 'system', label: 'System' },
]

export default function AdminScreen() {
	const router = useRouter()
	const { isAuthenticated, isLoading: authLoading, user } = useAuth()
	const [activeTab, setActiveTab] = useState('storage')

	if (authLoading) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" color={Colors.TextColor.tertiary} />
			</View>
		)
	}

	if (!isAuthenticated || user?.role !== 'admin') {
		router.replace('/')
		return null
	}

	return (
		<ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
			<View style={styles.screenHeader}>
				<Pressable onPress={() => router.back()} style={styles.backBtn}>
					<ArrowLeft size={18} color={Colors.TextColor.secondary} />
				</Pressable>
				<Shield size={22} color={Colors.TextColor.primary} />
				<Text style={styles.screenTitle}>Admin</Text>
			</View>

			<Tabs tabs={adminTabs} activeTab={activeTab} onChange={setActiveTab} />

			<View style={styles.tabContent}>
				{activeTab === 'storage' && <VolumesSection />}
				{activeTab === 'users' && (
					<>
						<UsersSection />
						<InvitesSection />
					</>
				)}
				{activeTab === 'system' && <UpdateSection />}
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: Colors.BackgroundColor.primary },
	screenContent: {
		maxWidth: 720,
		alignSelf: 'center',
		width: '100%',
		padding: 16,
		paddingBottom: 40,
	},
	screenHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
	backBtn: { padding: 6, borderRadius: Outlines.borderRadius.md },
	screenTitle: { fontSize: 20, fontWeight: '600', color: Colors.TextColor.primary },
	centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	tabContent: { marginTop: 24, gap: 24 },
	card: {
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: Colors.BorderColor.primary,
		borderRadius: Outlines.borderRadius.lg,
		...Outlines.shadow.sm,
	},
	cardHeader: {
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: Colors.BorderColor.secondary,
	},
	cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.TextColor.primary },
	volumeRow: {
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.BorderColor.secondary,
	},
	volumeInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	volLabel: { fontSize: 14, fontWeight: '500', color: Colors.TextColor.primary },
	volPath: {
		fontSize: 11,
		color: Colors.TextColor.tertiary,
		fontFamily: Typography.caption.fontFamily,
	},
	visBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: Outlines.borderRadius.md,
		borderWidth: 1,
	},
	visBadgePublic: { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
	visBadgePrivate: {
		borderColor: Colors.BorderColor.primary,
		backgroundColor: Colors.BackgroundColor.secondary,
	},
	visTextPublic: { fontSize: 11, color: '#047857' },
	visTextPrivate: { fontSize: 11, color: Colors.TextColor.secondary },
	accessPanel: {
		marginTop: 12,
		paddingLeft: 16,
		borderLeftWidth: 2,
		borderLeftColor: Colors.BorderColor.secondary,
	},
	accessTitle: {
		fontSize: 11,
		fontWeight: '500',
		color: Colors.TextColor.secondary,
		marginBottom: 8,
	},
	accessRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 4,
	},
	accessUsername: { fontSize: 13, color: Colors.TextColor.primary },
	userRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.BorderColor.secondary,
	},
	userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	userName: { fontSize: 14, fontWeight: '500', color: Colors.TextColor.primary },
	userMeta: { fontSize: 11, color: Colors.TextColor.tertiary, marginTop: 2 },
	resetBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: Outlines.borderRadius.md,
		borderWidth: 1,
		borderColor: Colors.BorderColor.primary,
		marginRight: 8,
	},
	resetBtnText: { fontSize: 11, color: Colors.TextColor.secondary },
	deleteBtn: { padding: 6, borderRadius: Outlines.borderRadius.md },
	createForm: {
		flexDirection: 'row',
		gap: 8,
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: Colors.BorderColor.secondary,
	},
	formInput: {
		flex: 1,
		backgroundColor: Colors.BackgroundColor.secondary,
		borderWidth: 1,
		borderColor: Colors.BorderColor.primary,
		borderRadius: Outlines.borderRadius.md,
		paddingHorizontal: 12,
		paddingVertical: 6,
		fontSize: 13,
		color: Colors.TextColor.primary,
	},
	createBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: Colors.BrandColor[600],
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: Outlines.borderRadius.md,
	},
	createBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '500' },
	emptyText: { fontSize: 12, color: Colors.TextColor.tertiary },
	emptyCenter: { textAlign: 'center', padding: 32, fontSize: 13, color: Colors.TextColor.tertiary },
})
