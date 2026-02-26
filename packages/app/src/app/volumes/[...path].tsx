import { useLocalSearchParams, useRouter } from 'expo-router'
import {
	Download,
	FolderPlus,
	HardDrive,
	LayoutGrid,
	List,
	LogOut,
	RefreshCw,
	Settings,
	Shield,
	Trash2,
	Upload,
	UploadCloud,
	X,
} from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
	ActivityIndicator,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Breadcrumbs from '@/components/Breadcrumbs'
import FileGrid from '@/components/FileGrid'
import FileList from '@/components/FileList'
import PreviewModal from '@/components/PreviewModal'
import SearchBar from '@/components/SearchBar'
import ShareDialog from '@/components/ShareDialog'
import UploadProgress from '@/components/UploadProgress'
import UploadZone from '@/components/UploadZone'
import EmptyState from '@/components/ui/EmptyState'
import { FileGridSkeleton, FileListSkeleton } from '@/components/ui/Skeleton'
import ToastContainer from '@/components/ui/Toast'
import VolumeSelector from '@/components/VolumeSelector'
import { useAuth } from '@/hooks/useAuth'
import { useCreateDirectory, useDeleteFile, useFiles } from '@/hooks/useFiles'
import { useSelection } from '@/hooks/useSelection'
import { useToast } from '@/hooks/useToast'
import { useUpload } from '@/hooks/useUpload'
import type { FileEntry } from '@/lib/api'
import { api } from '@/lib/api'
import { APP_NAME } from '@/lib/config'
import { Colors, Outlines, Sizing } from '@/theme'

function parseParams(params: Record<string, string | string[]>): {
	volume: string
	path: string
} {
	const pathSegments = params.path
	if (!pathSegments) return { volume: '', path: '' }

	const segments = Array.isArray(pathSegments) ? pathSegments : [pathSegments]
	const volume = decodeURIComponent(segments[0] || '')
	const filePath = segments.slice(1).map(decodeURIComponent).join('/')
	return { volume, path: filePath }
}

export default function FileBrowserScreen() {
	const params = useLocalSearchParams()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth()

	const { volume, path: currentPath } = useMemo(
		() => parseParams(params as Record<string, string | string[]>),
		[params],
	)

	const { data, isLoading, error, refetch } = useFiles(volume, currentPath)
	const { toasts, addToast, removeToast } = useToast()
	const deleteMutation = useDeleteFile(volume, currentPath)
	const mkdirMutation = useCreateDirectory(volume, currentPath)
	const { uploads, addFiles, pauseUpload, resumeUpload, cancelUpload, clearCompleted } = useUpload(
		volume,
		currentPath,
		refetch,
	)
	const [showUploadZone, setShowUploadZone] = useState(false)
	const [previewFile, setPreviewFile] = useState<FileEntry | null>(null)
	const [shareFile, setShareFile] = useState<FileEntry | null>(null)
	const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
	const [refreshSpinning, setRefreshSpinning] = useState(false)
	const {
		selected,
		toggle: toggleSelection,
		selectRange,
		selectAll,
		clear: clearSelection,
		count: selectionCount,
		lastToggled,
	} = useSelection()

	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			router.replace('/login')
		}
	}, [authLoading, isAuthenticated, router])

	const navigateTo = useCallback(
		(newPath: string) => {
			setPreviewFile(null)
			clearSelection()
			const segments = newPath
				? `${encodeURIComponent(volume)}/${newPath.split('/').map(encodeURIComponent).join('/')}`
				: encodeURIComponent(volume)
			router.push(`/volumes/${segments}` as any)
		},
		[volume, clearSelection, router],
	)

	const handleVolumeSelect = useCallback(
		(id: string) => {
			setPreviewFile(null)
			router.replace(`/volumes/${encodeURIComponent(id)}` as any)
		},
		[router],
	)

	const handleRename = useCallback(
		(file: FileEntry) => {
			// On web, use prompt. On native, this would need a modal input.
			if (Platform.OS === 'web') {
				const newName = window.prompt('Rename to:', file.name)
				if (newName && newName !== file.name) {
					const parentPath = file.path.includes('/')
						? file.path.split('/').slice(0, -1).join('/')
						: ''
					const destination = parentPath ? `${parentPath}/${newName}` : newName
					api.moveFile(volume, file.path, destination).then(
						() => {
							addToast('success', `Renamed to "${newName}"`)
							refetch()
						},
						(err) => addToast('error', `Rename failed: ${(err as Error).message}`),
					)
				}
			}
		},
		[volume, addToast, refetch],
	)

	const handleNewFolder = useCallback(() => {
		if (Platform.OS === 'web') {
			const name = window.prompt('New folder name:')
			if (name) {
				mkdirMutation.mutate(name, {
					onSuccess: () => addToast('success', `Created folder "${name}"`),
					onError: (err) => addToast('error', `Failed to create folder: ${(err as Error).message}`),
				})
			}
		}
	}, [mkdirMutation, addToast])

	const pathParts = currentPath.split('/').filter(Boolean)
	const breadcrumbs = pathParts.map((part, i) => ({
		label: part,
		path: pathParts.slice(0, i + 1).join('/'),
	}))

	if (authLoading) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" color={Colors.TextColor.tertiary} />
			</View>
		)
	}

	if (!isAuthenticated) return null

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[styles.content, selectionCount > 0 && { paddingBottom: 80 }]}
			>
				{/* Header */}
				<View style={styles.header}>
					<Pressable onPress={() => router.push('/')} style={styles.logoArea}>
						<Text style={styles.appTitle}>{APP_NAME}</Text>
					</Pressable>
					<View style={styles.headerActions}>
						<VolumeSelector selectedVolume={volume} onSelect={handleVolumeSelect} />
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

				{/* Search */}
				{volume ? (
					<View style={styles.searchRow}>
						<SearchBar volume={volume} onNavigate={navigateTo} />
					</View>
				) : null}

				{/* Toolbar */}
				<View style={styles.toolbar}>
					<Breadcrumbs segments={breadcrumbs} onNavigate={navigateTo} />
					<View style={styles.toolbarActions}>
						{volume ? (
							<Pressable
								onPress={() => setShowUploadZone(!showUploadZone)}
								style={[styles.toolbarButton, showUploadZone && styles.toolbarButtonActive]}
							>
								<Upload size={16} color={showUploadZone ? '#fff' : Colors.TextColor.secondary} />
							</Pressable>
						) : null}
						<Pressable onPress={handleNewFolder} style={styles.toolbarButton}>
							<FolderPlus size={16} color={Colors.TextColor.secondary} />
						</Pressable>
						<View style={styles.viewToggle}>
							<Pressable
								onPress={() => setViewMode('list')}
								style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
							>
								<List
									size={16}
									color={viewMode === 'list' ? Colors.TextColor.primary : Colors.TextColor.tertiary}
								/>
							</Pressable>
							<Pressable
								onPress={() => setViewMode('grid')}
								style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
							>
								<LayoutGrid
									size={16}
									color={viewMode === 'grid' ? Colors.TextColor.primary : Colors.TextColor.tertiary}
								/>
							</Pressable>
						</View>
						<Pressable
							onPress={() => {
								setRefreshSpinning(true)
								refetch().finally(() => setTimeout(() => setRefreshSpinning(false), 400))
							}}
							style={styles.iconButton}
						>
							<RefreshCw size={16} color={Colors.TextColor.tertiary} />
						</Pressable>
					</View>
				</View>

				{/* Upload Zone */}
				{showUploadZone && volume ? (
					<View style={styles.uploadZoneContainer}>
						<UploadZone
							onFilesSelected={(files) => {
								addFiles(files)
								setShowUploadZone(false)
							}}
						/>
					</View>
				) : null}

				{/* Content */}
				{!volume ? (
					<EmptyState icon={HardDrive} title="Select a volume to get started" />
				) : isLoading ? (
					viewMode === 'list' ? (
						<FileListSkeleton />
					) : (
						<FileGridSkeleton />
					)
				) : error ? (
					<View style={styles.errorContainer}>
						<Text style={styles.errorText}>Error loading files: {(error as Error).message}</Text>
					</View>
				) : viewMode === 'list' ? (
					<FileList
						entries={data?.entries || []}
						volume={volume}
						onNavigate={navigateTo}
						onDelete={(path) =>
							deleteMutation.mutate(path, {
								onSuccess: () => addToast('success', 'File deleted'),
								onError: (err) => addToast('error', `Delete failed: ${(err as Error).message}`),
							})
						}
						onPreview={setPreviewFile}
						onShare={setShareFile}
						selectable
						selected={selected}
						onToggle={toggleSelection}
						onShiftSelect={selectRange}
						lastToggled={lastToggled}
						onSelectAll={(paths) => (paths.length > 0 ? selectAll(paths) : clearSelection())}
					/>
				) : (
					<FileGrid
						entries={data?.entries || []}
						volume={volume}
						onNavigate={navigateTo}
						onPreview={setPreviewFile}
						selectable
						selected={selected}
						onToggle={toggleSelection}
						onShiftSelect={selectRange}
						lastToggled={lastToggled}
					/>
				)}
			</ScrollView>

			{/* Bulk Action Bar */}
			{selectionCount > 0 ? (
				<View style={[styles.bulkBar, { paddingBottom: insets.bottom || 12 }]}>
					<Text style={styles.bulkBarText}>{selectionCount} selected</Text>
					<View style={styles.bulkBarActions}>
						<Pressable
							onPress={async () => {
								const paths = Array.from(selected)
								for (const path of paths) {
									try {
										await api.deleteFile(volume, path)
									} catch {}
								}
								clearSelection()
								refetch()
								addToast('success', `Deleted ${paths.length} items`)
							}}
							style={styles.bulkDeleteBtn}
						>
							<Trash2 size={16} color="#fff" />
							<Text style={styles.bulkDeleteText}>Delete</Text>
						</Pressable>
						<Pressable onPress={clearSelection} style={styles.iconButton}>
							<X size={16} color={Colors.TextColor.tertiary} />
						</Pressable>
					</View>
				</View>
			) : null}

			{/* Preview Modal */}
			{previewFile ? (
				<PreviewModal file={previewFile} volume={volume} onClose={() => setPreviewFile(null)} />
			) : null}

			{/* Share Dialog */}
			{shareFile ? (
				<ShareDialog file={shareFile} volume={volume} onClose={() => setShareFile(null)} />
			) : null}

			{/* Upload Progress */}
			<UploadProgress
				uploads={uploads}
				onPause={pauseUpload}
				onResume={resumeUpload}
				onCancel={cancelUpload}
				onClearCompleted={clearCompleted}
			/>

			<ToastContainer toasts={toasts} onDismiss={removeToast} />
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.BackgroundColor.secondary,
	},
	scrollView: {
		flex: 1,
	},
	content: {
		paddingHorizontal: Sizing.gutters.base,
		paddingVertical: Sizing.layout.x24,
		maxWidth: 1152,
		width: '100%',
		alignSelf: 'center',
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
		gap: 12,
		marginBottom: Sizing.layout.x24,
	},
	logoArea: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	appTitle: {
		fontSize: 20,
		fontWeight: '600',
		color: Colors.TextColor.primary,
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	iconButton: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: Outlines.borderRadius.md,
	},
	searchRow: {
		marginBottom: Sizing.layout.x16,
	},
	toolbar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: Sizing.layout.x16,
	},
	toolbarActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginLeft: 16,
	},
	toolbarButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: Outlines.borderRadius.md,
		borderWidth: Outlines.borderWidth.normal,
		borderColor: Colors.BorderColor.primary,
		backgroundColor: Colors.BackgroundColor.primary,
	},
	toolbarButtonActive: {
		backgroundColor: Colors.BrandColor[600],
		borderColor: Colors.BrandColor[600],
	},
	viewToggle: {
		flexDirection: 'row',
		borderWidth: Outlines.borderWidth.normal,
		borderColor: Colors.BorderColor.primary,
		borderRadius: Outlines.borderRadius.md,
		backgroundColor: Colors.BackgroundColor.primary,
		overflow: 'hidden',
	},
	viewToggleBtn: {
		padding: 6,
	},
	viewToggleBtnActive: {
		backgroundColor: Colors.BackgroundColor.tertiary,
	},
	uploadZoneContainer: {
		marginBottom: Sizing.layout.x16,
	},
	errorContainer: {
		alignItems: 'center',
		paddingVertical: 80,
	},
	errorText: {
		fontSize: 14,
		color: Colors.StatusColor.error,
	},
	bulkBar: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: Sizing.gutters.base,
		paddingTop: 12,
		backgroundColor: 'rgba(255,255,255,0.95)',
		borderTopWidth: Outlines.borderWidth.normal,
		borderTopColor: Colors.BorderColor.primary,
		...Outlines.shadow.md,
	},
	bulkBarText: {
		fontSize: 14,
		fontWeight: '500',
		color: Colors.BrandColor[700],
	},
	bulkBarActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	bulkDeleteBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: Colors.StatusColor.error,
		borderRadius: Outlines.borderRadius.md,
	},
	bulkDeleteText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '500',
	},
})
