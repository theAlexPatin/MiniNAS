import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { ArrowLeft, Check, Copy, HardDrive, Key, Plus, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import Tabs from '@/components/ui/Tabs'
import { useAuth } from '@/hooks/useAuth'
import {
	useCreateWebDAVToken,
	useRevokeWebDAVToken,
	useWebDAVTokens,
} from '@/hooks/useWebDAVTokens'
import { getApiBase } from '@/lib/api'
import { APP_NAME } from '@/lib/config'
import { formatDate } from '@/lib/format'
import { Colors, Outlines, Typography } from '@/theme'

function AccessTokens() {
	const { data, isLoading } = useWebDAVTokens()
	const createMutation = useCreateWebDAVToken()
	const revokeMutation = useRevokeWebDAVToken()
	const [label, setLabel] = useState('')
	const [newToken, setNewToken] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)

	const handleCreate = async () => {
		if (!label.trim()) return
		const result = await createMutation.mutateAsync(label.trim())
		setNewToken(result.token)
		setLabel('')
	}

	const handleCopy = async (text: string) => {
		await Clipboard.setStringAsync(text)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const handleRevoke = (id: string) => {
		Alert.alert('Revoke Token', 'Revoke this token? Any clients using it will be disconnected.', [
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Revoke', style: 'destructive', onPress: () => revokeMutation.mutate(id) },
		])
	}

	return (
		<View style={styles.section}>
			{/* Create Token */}
			<View style={styles.card}>
				<Text style={styles.cardTitle}>Create Access Token</Text>
				<View style={styles.createRow}>
					<TextInput
						value={label}
						onChangeText={setLabel}
						placeholder="Token label (e.g. MacBook, Desktop)"
						placeholderTextColor={Colors.TextColor.tertiary}
						style={styles.input}
						onSubmitEditing={handleCreate}
					/>
					<Pressable
						onPress={handleCreate}
						disabled={!label.trim() || createMutation.isPending}
						style={[
							styles.createBtn,
							(!label.trim() || createMutation.isPending) && { opacity: 0.5 },
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

				{newToken && (
					<View style={styles.tokenCreated}>
						<Text style={styles.tokenCreatedTitle}>
							Token created! Copy it now — it won't be shown again.
						</Text>
						<View style={styles.tokenRow}>
							<Text style={styles.tokenValue} selectable>
								{newToken}
							</Text>
							<Pressable onPress={() => handleCopy(newToken)} style={styles.copyBtn}>
								{copied ? <Check size={16} color="#047857" /> : <Copy size={16} color="#047857" />}
							</Pressable>
						</View>
						<Pressable onPress={() => setNewToken(null)}>
							<Text style={styles.dismissText}>Dismiss</Text>
						</Pressable>
					</View>
				)}
			</View>

			{/* Token List */}
			<View style={styles.card}>
				<Text style={styles.cardTitle}>Active Tokens</Text>
				{isLoading ? (
					<ActivityIndicator
						size="small"
						style={{ padding: 32 }}
						color={Colors.TextColor.tertiary}
					/>
				) : !data?.tokens.length ? (
					<Text style={styles.emptyText}>No tokens yet. Create one to connect via WebDAV.</Text>
				) : (
					data.tokens.map((token) => (
						<View key={token.id} style={styles.tokenItem}>
							<Key size={16} color={Colors.TextColor.tertiary} />
							<View style={{ flex: 1 }}>
								<Text style={styles.tokenLabel}>{token.label}</Text>
								<Text style={styles.tokenMeta}>
									Created {formatDate(token.created_at)}
									{token.last_used_at ? ` · Last used ${formatDate(token.last_used_at)}` : ''}
								</Text>
							</View>
							<Pressable onPress={() => handleRevoke(token.id)} style={styles.deleteBtn}>
								<Trash2 size={16} color={Colors.TextColor.tertiary} />
							</Pressable>
						</View>
					))
				)}
			</View>
		</View>
	)
}

export default function SettingsScreen() {
	const router = useRouter()
	const { isAuthenticated, isLoading: authLoading, user } = useAuth()

	if (authLoading) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" color={Colors.TextColor.tertiary} />
			</View>
		)
	}

	if (!isAuthenticated) {
		router.replace('/login')
		return null
	}

	return (
		<ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
			<View style={styles.screenHeader}>
				<Pressable onPress={() => router.back()} style={styles.backBtn}>
					<ArrowLeft size={18} color={Colors.TextColor.secondary} />
				</Pressable>
				<HardDrive size={22} color={Colors.TextColor.primary} />
				<Text style={styles.screenTitle}>Network Drive Access</Text>
			</View>

			<AccessTokens />
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: Colors.BackgroundColor.primary },
	screenContent: {
		maxWidth: 640,
		alignSelf: 'center',
		width: '100%',
		padding: 16,
		paddingBottom: 40,
	},
	screenHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
	backBtn: { padding: 6, borderRadius: Outlines.borderRadius.md },
	screenTitle: { fontSize: 20, fontWeight: '600', color: Colors.TextColor.primary },
	centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	section: { gap: 16 },
	card: {
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: Colors.BorderColor.primary,
		borderRadius: Outlines.borderRadius.lg,
		padding: 20,
		...Outlines.shadow.sm,
	},
	cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.TextColor.primary, marginBottom: 12 },
	createRow: { flexDirection: 'row', gap: 8 },
	input: {
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
	tokenCreated: {
		marginTop: 16,
		backgroundColor: '#ecfdf5',
		borderWidth: 1,
		borderColor: '#a7f3d0',
		borderRadius: Outlines.borderRadius.lg,
		padding: 16,
	},
	tokenCreatedTitle: { fontSize: 13, fontWeight: '500', color: '#065f46', marginBottom: 8 },
	tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	tokenValue: {
		flex: 1,
		fontFamily: Typography.caption.fontFamily,
		fontSize: 12,
		color: '#064e3b',
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: '#a7f3d0',
		borderRadius: Outlines.borderRadius.sm,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	copyBtn: { padding: 6, borderRadius: Outlines.borderRadius.md },
	dismissText: { fontSize: 11, color: '#047857', marginTop: 8 },
	tokenItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 12,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: Colors.BorderColor.secondary,
	},
	tokenLabel: { fontSize: 13, fontWeight: '500', color: Colors.TextColor.primary },
	tokenMeta: { fontSize: 11, color: Colors.TextColor.tertiary, marginTop: 2 },
	deleteBtn: { padding: 6, borderRadius: Outlines.borderRadius.md },
	emptyText: { textAlign: 'center', padding: 32, fontSize: 13, color: Colors.TextColor.tertiary },
})
