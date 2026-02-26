import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { HardDrive, Loader2, LogOut, Settings, Shield } from 'lucide-react-native'
import { useEffect } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/hooks/useAuth'
import { api, type VolumeInfo } from '@/lib/api'
import { APP_NAME } from '@/lib/config'
import { formatBytes } from '@/lib/format'
import { Colors, Outlines, Sizing } from '@/theme'

function VolumeTile({ volume }: { volume: VolumeInfo }) {
	const router = useRouter()
	const usagePercent = volume.totalBytes > 0 ? (volume.usedBytes / volume.totalBytes) * 100 : 0
	const barColor =
		usagePercent > 90
			? Colors.StatusColor.error
			: usagePercent > 75
				? Colors.StatusColor.warning
				: Colors.BrandColor[500]

	return (
		<Pressable
			onPress={() => router.push(`/volumes/${encodeURIComponent(volume.id)}` as any)}
			style={styles.volumeTile}
		>
			<View style={styles.volumeTileHeader}>
				<View style={styles.volumeIcon}>
					<HardDrive size={20} color={Colors.BrandColor[600]} />
				</View>
				<Text style={styles.volumeLabel}>{volume.label}</Text>
			</View>
			<View>
				<View style={styles.usageBarBg}>
					<View
						style={[
							styles.usageBarFill,
							{ width: `${usagePercent}%` as any, backgroundColor: barColor },
						]}
					/>
				</View>
				<Text style={styles.usageText}>
					{formatBytes(volume.usedBytes)} used of {formatBytes(volume.totalBytes)}
				</Text>
			</View>
		</Pressable>
	)
}

export default function HomeScreen() {
	const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth()
	const router = useRouter()
	const insets = useSafeAreaInsets()

	const { data, isLoading } = useQuery({
		queryKey: ['volumes'],
		queryFn: () => api.getVolumes(),
		enabled: isAuthenticated,
	})

	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			router.replace('/login')
		}
	}, [authLoading, isAuthenticated, router])

	const volumes = data?.volumes || []

	// Single volume — redirect straight into it
	useEffect(() => {
		if (!isLoading && volumes.length === 1) {
			router.replace(`/volumes/${encodeURIComponent(volumes[0].id)}` as any)
		}
	}, [isLoading, volumes, router])

	if (authLoading) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" color={Colors.TextColor.tertiary} />
			</View>
		)
	}

	if (!isAuthenticated) return null

	return (
		<ScrollView
			style={[styles.container, { paddingTop: insets.top }]}
			contentContainerStyle={styles.content}
		>
			{/* Header */}
			<View style={styles.header}>
				<Text style={styles.appTitle}>{APP_NAME}</Text>
				<View style={styles.headerActions}>
					{user?.role === 'admin' && (
						<Pressable onPress={() => router.push('/admin')} style={styles.iconButton}>
							<Shield size={18} color={Colors.TextColor.tertiary} />
						</Pressable>
					)}
					<Pressable onPress={() => router.push('/settings')} style={styles.iconButton}>
						<Settings size={18} color={Colors.TextColor.tertiary} />
					</Pressable>
					<Pressable onPress={logout} style={styles.iconButton}>
						<LogOut size={18} color={Colors.TextColor.tertiary} />
					</Pressable>
				</View>
			</View>

			{/* Content */}
			{isLoading ? (
				<View style={styles.loadingGrid}>
					{[0, 1, 2].map((i) => (
						<View key={i} style={styles.skeletonTile}>
							<View style={styles.skeletonRow}>
								<View style={[styles.skeletonBox, { width: 40, height: 40 }]} />
								<View style={[styles.skeletonBox, { width: 120, height: 20 }]} />
							</View>
							<View style={[styles.skeletonBox, { height: 8, marginBottom: 6 }]} />
							<View style={[styles.skeletonBox, { width: 160, height: 16 }]} />
						</View>
					))}
				</View>
			) : volumes.length === 0 ? (
				<View style={styles.empty}>
					<HardDrive size={48} color={Colors.BorderColor.primary} />
					<Text style={styles.emptyTitle}>No volumes available</Text>
					{user?.role === 'admin' && (
						<Text style={styles.emptySubtitle}>Add volumes in the admin panel</Text>
					)}
				</View>
			) : (
				<>
					<Text style={styles.sectionTitle}>VOLUMES</Text>
					<View style={styles.volumeGrid}>
						{volumes.map((v) => (
							<VolumeTile key={v.id} volume={v} />
						))}
					</View>
				</>
			)}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.BackgroundColor.secondary,
	},
	content: {
		paddingHorizontal: Sizing.gutters.base,
		paddingVertical: Sizing.layout.x24,
	},
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: Sizing.layout.x40,
	},
	appTitle: {
		fontSize: 20,
		fontWeight: '600',
		color: Colors.TextColor.primary,
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizing.layout.x8,
	},
	iconButton: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: Outlines.borderRadius.md,
	},
	sectionTitle: {
		fontSize: 12,
		fontWeight: '500',
		color: Colors.TextColor.secondary,
		letterSpacing: 1,
		marginBottom: Sizing.layout.x16,
	},
	volumeGrid: {
		gap: Sizing.layout.x16,
	},
	volumeTile: {
		backgroundColor: Colors.BackgroundColor.primary,
		borderRadius: Outlines.borderRadius.xl,
		borderWidth: Outlines.borderWidth.normal,
		borderColor: Colors.BorderColor.primary,
		padding: Sizing.layout.x20,
		gap: Sizing.layout.x12,
		...Outlines.shadow.sm,
	},
	volumeTileHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizing.layout.x12,
	},
	volumeIcon: {
		width: 40,
		height: 40,
		borderRadius: Outlines.borderRadius.lg,
		backgroundColor: Colors.BrandColor[50],
		alignItems: 'center',
		justifyContent: 'center',
	},
	volumeLabel: {
		fontSize: 18,
		fontWeight: '600',
		color: Colors.TextColor.primary,
	},
	usageBarBg: {
		height: 8,
		borderRadius: 4,
		backgroundColor: Colors.BackgroundColor.tertiary,
		overflow: 'hidden',
	},
	usageBarFill: {
		height: 8,
		borderRadius: 4,
	},
	usageText: {
		fontSize: 14,
		color: Colors.TextColor.secondary,
		marginTop: 6,
	},
	empty: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 80,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: '500',
		color: Colors.TextColor.secondary,
		marginTop: 12,
	},
	emptySubtitle: {
		fontSize: 14,
		color: Colors.TextColor.tertiary,
		marginTop: 4,
	},
	loadingGrid: {
		gap: Sizing.layout.x16,
	},
	skeletonTile: {
		backgroundColor: Colors.BackgroundColor.primary,
		borderRadius: Outlines.borderRadius.xl,
		borderWidth: Outlines.borderWidth.normal,
		borderColor: Colors.BorderColor.primary,
		padding: Sizing.layout.x20,
		gap: Sizing.layout.x12,
	},
	skeletonRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizing.layout.x12,
	},
	skeletonBox: {
		backgroundColor: Colors.BorderColor.primary,
		borderRadius: Outlines.borderRadius.md,
	},
})
