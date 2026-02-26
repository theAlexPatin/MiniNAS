import {
	AlertCircle,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Pause,
	Play,
	X,
} from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { UploadItem } from '@/hooks/useUpload'
import { formatBytes } from '@/lib/format'
import { Colors, Outlines } from '@/theme'

interface UploadProgressProps {
	uploads: UploadItem[]
	onPause: (id: string) => void
	onResume: (id: string) => void
	onCancel: (id: string) => void
	onClearCompleted: () => void
}

export default function UploadProgress({
	uploads,
	onPause,
	onResume,
	onCancel,
	onClearCompleted,
}: UploadProgressProps) {
	const [collapsed, setCollapsed] = useState(false)

	if (uploads.length === 0) return null

	const active = uploads.filter((u) => u.status === 'uploading' || u.status === 'pending')
	const completed = uploads.filter((u) => u.status === 'complete')

	return (
		<View style={styles.container}>
			{/* Header */}
			<Pressable onPress={() => setCollapsed(!collapsed)} style={styles.header}>
				<Text style={styles.headerText}>
					{active.length > 0
						? `Uploading ${active.length} file${active.length > 1 ? 's' : ''}...`
						: `${completed.length} upload${completed.length > 1 ? 's' : ''} complete`}
				</Text>
				<View style={styles.headerRight}>
					{completed.length > 0 && (
						<Pressable
							onPress={(e) => {
								e.stopPropagation?.()
								onClearCompleted()
							}}
						>
							<Text style={styles.clearText}>Clear completed</Text>
						</Pressable>
					)}
					{collapsed ? (
						<ChevronUp size={16} color={Colors.TextColor.tertiary} />
					) : (
						<ChevronDown size={16} color={Colors.TextColor.tertiary} />
					)}
				</View>
			</Pressable>

			{/* Items */}
			{!collapsed && (
				<View style={styles.list}>
					{uploads.map((item) => (
						<View key={item.id} style={styles.item}>
							{item.status === 'complete' && (
								<CheckCircle size={16} color={Colors.StatusColor.success} />
							)}
							{item.status === 'error' && (
								<AlertCircle size={16} color={Colors.StatusColor.error} />
							)}

							<View style={styles.itemInfo}>
								<Text style={styles.itemName} numberOfLines={1}>
									{item.file.name}
								</Text>
								<View style={styles.progressRow}>
									<View style={styles.progressTrack}>
										<View
											style={[
												styles.progressFill,
												{
													width: `${item.progress}%`,
													backgroundColor:
														item.status === 'error'
															? Colors.StatusColor.error
															: item.status === 'complete'
																? Colors.StatusColor.success
																: Colors.BrandColor[600],
												},
											]}
										/>
									</View>
									<Text style={styles.progressText}>
										{item.progress}% · {formatBytes(item.file.size)}
									</Text>
								</View>
								{item.error && <Text style={styles.errorText}>{item.error}</Text>}
							</View>

							<View style={styles.controls}>
								{item.status === 'uploading' && (
									<Pressable onPress={() => onPause(item.id)} style={styles.controlBtn}>
										<Pause size={14} color={Colors.TextColor.secondary} />
									</Pressable>
								)}
								{item.status === 'paused' && (
									<Pressable onPress={() => onResume(item.id)} style={styles.controlBtn}>
										<Play size={14} color={Colors.TextColor.secondary} />
									</Pressable>
								)}
								{item.status !== 'complete' && (
									<Pressable onPress={() => onCancel(item.id)} style={styles.controlBtn}>
										<X size={14} color={Colors.TextColor.tertiary} />
									</Pressable>
								)}
							</View>
						</View>
					))}
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: '#ffffff',
		borderTopWidth: 1,
		borderTopColor: Colors.BorderColor.primary,
		...Outlines.shadow.lg,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	headerText: {
		fontSize: 13,
		fontWeight: '500',
		color: Colors.TextColor.primary,
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	clearText: {
		fontSize: 11,
		color: Colors.TextColor.tertiary,
	},
	list: {
		maxHeight: 256,
		paddingHorizontal: 16,
		paddingBottom: 12,
	},
	item: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 8,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: Colors.BorderColor.secondary,
	},
	itemInfo: {
		flex: 1,
	},
	itemName: {
		fontSize: 13,
		color: Colors.TextColor.primary,
	},
	progressRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 4,
	},
	progressTrack: {
		flex: 1,
		height: 6,
		backgroundColor: Colors.BackgroundColor.tertiary,
		borderRadius: 3,
		overflow: 'hidden',
	},
	progressFill: {
		height: '100%',
		borderRadius: 3,
	},
	progressText: {
		fontSize: 11,
		color: Colors.TextColor.tertiary,
	},
	errorText: {
		fontSize: 11,
		color: Colors.StatusColor.error,
		marginTop: 2,
	},
	controls: {
		flexDirection: 'row',
		gap: 4,
	},
	controlBtn: {
		padding: 4,
	},
})
