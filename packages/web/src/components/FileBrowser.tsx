import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	Download,
	FolderPlus,
	HardDrive,
	LayoutGrid,
	List,
	Loader2,
	LogOut,
	RefreshCw,
	Settings,
	Shield,
	Trash2,
	Upload,
	UploadCloud,
	X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCreateDirectory, useDeleteFile, useFiles } from '../hooks/useFiles'
import { useSelection } from '../hooks/useSelection'
import { useToast } from '../hooks/useToast'
import { useUpload } from '../hooks/useUpload'
import type { FileEntry } from '../lib/api'
import { api } from '../lib/api'
import { BASE_PATH, withBase } from '../lib/basePath'
import { getFilesFromDataTransfer } from '../lib/drop'
import Breadcrumbs from './Breadcrumbs'
import ContextMenu from './ContextMenu'
import FileGrid from './FileGrid'
import FileList from './FileList'
import PreviewModal from './PreviewModal'
import SearchBar from './SearchBar'
import ShareDialog from './ShareDialog'
import UploadProgress from './UploadProgress'
import UploadZone from './UploadZone'
import EmptyState from './ui/EmptyState'
import { FileGridSkeleton, FileListSkeleton } from './ui/Skeleton'
import ToastContainer from './ui/Toast'
import VolumeSelector from './VolumeSelector'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 30_000, retry: 1 },
	},
})

function parsePath(pathname: string): { volume: string; path: string } {
	let p = pathname
	if (BASE_PATH && p.startsWith(BASE_PATH)) {
		p = p.slice(BASE_PATH.length)
	}
	const match = p.match(/^\/volumes\/([^/]+)(?:\/(.*))?$/)
	if (!match) return { volume: '', path: '' }
	return {
		volume: decodeURIComponent(match[1]),
		path: match[2] ? decodeURIComponent(match[2]).replace(/\/$/, '') : '',
	}
}

function buildUrl(vol: string, pathStr: string): string {
	let url = '/volumes'
	if (vol) {
		url += `/${encodeURIComponent(vol)}`
		if (pathStr) {
			url += '/' + pathStr.split('/').map(encodeURIComponent).join('/')
		}
	}
	return withBase(url)
}

function FileBrowserInner() {
	const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth()

	// Single source of truth: the URL pathname.
	// volume and currentPath are derived from it — no stale closure issues.
	const [locationPath, setLocationPath] = useState(() =>
		typeof window !== 'undefined' ? window.location.pathname : '/volumes',
	)
	const isInitialNav = useRef(true)

	const { volume, path: currentPath } = useMemo(() => parsePath(locationPath), [locationPath])

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
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileEntry } | null>(
		null,
	)
	const {
		selected,
		toggle: toggleSelection,
		selectRange,
		selectAll,
		clear: clearSelection,
		count: selectionCount,
		lastToggled,
	} = useSelection()

	const fileAreaRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (selectionCount === 0) return
		const onClick = (e: MouseEvent) => {
			if (fileAreaRef.current?.contains(e.target as Node)) return
			// Don't clear if clicking inside the bulk action bar
			if ((e.target as HTMLElement).closest('[data-bulk-actions]')) return
			clearSelection()
		}
		window.addEventListener('click', onClick)
		return () => window.removeEventListener('click', onClick)
	}, [selectionCount, clearSelection])

	// Global drag-and-drop: show overlay when files are dragged anywhere on page
	const [globalDragging, setGlobalDragging] = useState(false)
	const dragCounter = useRef(0)

	useEffect(() => {
		const onDragEnter = (e: DragEvent) => {
			e.preventDefault()
			dragCounter.current++
			if (e.dataTransfer?.types.includes('Files')) {
				setGlobalDragging(true)
			}
		}
		const onDragLeave = (e: DragEvent) => {
			e.preventDefault()
			dragCounter.current--
			if (dragCounter.current === 0) {
				setGlobalDragging(false)
			}
		}
		const onDragOver = (e: DragEvent) => {
			e.preventDefault()
		}
		const onDrop = async (e: DragEvent) => {
			e.preventDefault()
			dragCounter.current = 0
			setGlobalDragging(false)
			if (!volume || !e.dataTransfer) return
			const files = await getFilesFromDataTransfer(e.dataTransfer)
			if (files.length > 0) {
				addFiles(files)
			}
		}
		window.addEventListener('dragenter', onDragEnter)
		window.addEventListener('dragleave', onDragLeave)
		window.addEventListener('dragover', onDragOver)
		window.addEventListener('drop', onDrop)
		return () => {
			window.removeEventListener('dragenter', onDragEnter)
			window.removeEventListener('dragleave', onDragLeave)
			window.removeEventListener('dragover', onDragOver)
			window.removeEventListener('drop', onDrop)
		}
	}, [volume, addFiles])

	// Navigate to a directory path within the current volume
	const navigateTo = useCallback(
		(newPath: string) => {
			// Read volume fresh from current locationPath to avoid stale closures
			const { volume: currentVol } = parsePath(
				typeof window !== 'undefined' ? window.location.pathname : '/volumes',
			)
			const url = buildUrl(currentVol, newPath)
			history.pushState(null, '', url)
			setLocationPath(url)
			setPreviewFile(null)
			clearSelection()
		},
		[clearSelection],
	)

	// Handle volume selection
	const handleVolumeSelect = useCallback((id: string) => {
		const url = buildUrl(id, '')
		if (isInitialNav.current) {
			isInitialNav.current = false
			history.replaceState(null, '', url)
		} else {
			history.pushState(null, '', url)
		}
		setLocationPath(url)
		setPreviewFile(null)
	}, [])

	// Handle browser back/forward
	useEffect(() => {
		const onPopState = () => {
			setLocationPath(window.location.pathname)
			setPreviewFile(null)
		}
		window.addEventListener('popstate', onPopState)
		return () => window.removeEventListener('popstate', onPopState)
	}, [])

	const handleContextMenu = useCallback((file: FileEntry, x: number, y: number) => {
		setContextMenu({ x, y, file })
	}, [])

	const handleRename = useCallback(
		(file: FileEntry) => {
			const newName = prompt('Rename to:', file.name)
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
		},
		[volume, addToast, refetch],
	)

	const handleNewFolder = useCallback(() => {
		const name = prompt('New folder name:')
		if (name) {
			mkdirMutation.mutate(name, {
				onSuccess: () => addToast('success', `Created folder "${name}"`),
				onError: (err) => addToast('error', `Failed to create folder: ${(err as Error).message}`),
			})
		}
	}, [mkdirMutation, addToast])

	// Build breadcrumb segments
	const pathParts = currentPath.split('/').filter(Boolean)
	const breadcrumbs = pathParts.map((part, i) => ({
		label: part,
		path: pathParts.slice(0, i + 1).join('/'),
	}))

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

	return (
		<div className={`max-w-6xl mx-auto px-4 py-6 ${selectionCount > 0 ? 'pb-20' : ''}`}>
			{/* Header */}
			<div className="flex items-center justify-between gap-3 mb-6">
				<a href={withBase('/')} className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
					<img src="/logo.png" alt="MiniNAS" className="w-8 h-8" />
					<h1 className="text-xl font-semibold text-gray-900 hidden sm:block">MiniNAS</h1>
				</a>
				<div className="flex items-center gap-2 sm:gap-4 min-w-0">
					<VolumeSelector selectedVolume={volume} onSelect={handleVolumeSelect} />
					{user?.role === 'admin' && (
						<a
							href={withBase('/admin')}
							className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
							title="Admin"
						>
							<Shield size={18} />
						</a>
					)}
					<a
						href={withBase('/settings')}
						className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
						title="Settings"
					>
						<Settings size={18} />
					</a>
					<button
						type="button"
						onClick={logout}
						className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
						title="Sign out"
					>
						<LogOut size={18} />
					</button>
				</div>
			</div>

			{/* Search */}
			{volume && (
				<div className="mb-4">
					<SearchBar volume={volume} onNavigate={navigateTo} />
				</div>
			)}

			{/* Toolbar */}
			<div className="flex items-center justify-between mb-4">
				{/* Breadcrumbs */}
				<Breadcrumbs segments={breadcrumbs} onNavigate={navigateTo} />

				{/* Actions */}
				<div className="flex items-center gap-2 shrink-0 ml-4">
					{volume && (
						<button
							type="button"
							onClick={() => setShowUploadZone(!showUploadZone)}
							className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
								showUploadZone
									? 'bg-brand-600 hover:bg-brand-700 text-white'
									: 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm'
							}`}
							title="Upload"
						>
							<Upload size={16} />
							<span className="hidden sm:inline">Upload</span>
						</button>
					)}
					<button
						type="button"
						onClick={handleNewFolder}
						className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm transition-colors"
						title="New Folder"
					>
						<FolderPlus size={16} />
						<span className="hidden sm:inline">New Folder</span>
					</button>
					<div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm">
						<button
							type="button"
							onClick={() => setViewMode('list')}
							className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
							title="List view"
						>
							<List size={16} />
						</button>
						<button
							type="button"
							onClick={() => setViewMode('grid')}
							className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
							title="Grid view"
						>
							<LayoutGrid size={16} />
						</button>
					</div>
					<button
						type="button"
						onClick={() => {
							setRefreshSpinning(true)
							refetch().finally(() => {
								setTimeout(() => setRefreshSpinning(false), 400)
							})
						}}
						className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
						title="Refresh"
					>
						<RefreshCw size={16} className={refreshSpinning ? 'animate-spin' : ''} />
					</button>
				</div>
			</div>

			{/* Upload Zone */}
			{showUploadZone && volume && (
				<div className="mb-4">
					<UploadZone
						onFilesSelected={(files) => {
							addFiles(files)
							setShowUploadZone(false)
						}}
					/>
				</div>
			)}

			{/* Bulk Action Bar - fixed bottom */}
			<div
				className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-200 ease-out ${selectionCount > 0 ? 'translate-y-0' : 'translate-y-full'}`}
			>
				<div data-bulk-actions className="bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
					<div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
						<span className="text-sm font-medium text-brand-700 whitespace-nowrap">
							{selectionCount} selected
						</span>
						<div className="flex items-center gap-2 ml-auto">
							<button
								type="button"
								onClick={async () => {
									const paths = Array.from(selected)
									try {
										const res = await fetch(`${withBase('/api/v1')}/download/zip`, {
											method: 'POST',
											credentials: 'include',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify({ volume, paths }),
										})
										if (!res.ok) throw new Error('Download failed')
										const blob = await res.blob()
										const url = URL.createObjectURL(blob)
										const a = document.createElement('a')
										a.href = url
										a.download = 'download.zip'
										a.click()
										URL.revokeObjectURL(url)
									} catch (err) {
										addToast('error', `Download failed: ${(err as Error).message}`)
									}
								}}
								className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm transition-colors"
							>
								<Download size={16} />
								<span className="hidden sm:inline">Download</span>
							</button>
							<button
								type="button"
								onClick={async () => {
									if (!confirm(`Delete ${selectionCount} items?`)) return
									const paths = Array.from(selected)
									let failed = 0
									for (const path of paths) {
										try {
											await api.deleteFile(volume, path)
										} catch {
											failed++
										}
									}
									clearSelection()
									refetch()
									if (failed > 0) {
										addToast('error', `Failed to delete ${failed} items`)
									} else {
										addToast('success', `Deleted ${paths.length} items`)
									}
								}}
								className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
							>
								<Trash2 size={16} />
								<span className="hidden sm:inline">Delete</span>
							</button>
							<button
								type="button"
								onClick={clearSelection}
								className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
								title="Clear selection"
							>
								<X size={16} />
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div ref={fileAreaRef}>
			{!volume ? (
				<EmptyState icon={HardDrive} title="Select a volume to get started" />
			) : isLoading ? (
				viewMode === 'list' ? (
					<FileListSkeleton />
				) : (
					<FileGridSkeleton />
				)
			) : error ? (
				<div className="text-center py-20 text-red-500">
					Error loading files: {(error as Error).message}
				</div>
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
					onContextMenu={handleContextMenu}
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
					onContextMenu={handleContextMenu}
					selectable
					selected={selected}
					onToggle={toggleSelection}
					onShiftSelect={selectRange}
					lastToggled={lastToggled}
				/>
			)}
			</div>
			{/* Preview Modal */}
			{previewFile && (
				<PreviewModal file={previewFile} volume={volume} onClose={() => setPreviewFile(null)} />
			)}

			{/* Share Dialog */}
			{shareFile && (
				<ShareDialog file={shareFile} volume={volume} onClose={() => setShareFile(null)} />
			)}

			{/* Context Menu */}
			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					file={contextMenu.file}
					onClose={() => setContextMenu(null)}
					onPreview={() => setPreviewFile(contextMenu.file)}
					onDownload={() => {
						window.open(api.getDownloadUrl(volume, contextMenu.file.path), '_blank')
					}}
					onShare={() => setShareFile(contextMenu.file)}
					onRename={() => handleRename(contextMenu.file)}
					onDelete={() => {
						if (confirm(`Delete "${contextMenu.file.name}"?`)) {
							deleteMutation.mutate(contextMenu.file.path, {
								onSuccess: () => addToast('success', 'File deleted'),
								onError: (err) => addToast('error', `Delete failed: ${(err as Error).message}`),
							})
						}
					}}
				/>
			)}

			{/* Upload Progress Panel */}
			<UploadProgress
				uploads={uploads}
				onPause={pauseUpload}
				onResume={resumeUpload}
				onCancel={cancelUpload}
				onClearCompleted={clearCompleted}
			/>

			{/* Global drag-and-drop overlay */}
			{globalDragging && volume && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-600/10 backdrop-blur-sm pointer-events-none">
					<div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-500 bg-white/90 px-16 py-12 shadow-lg">
						<UploadCloud size={48} className="text-brand-500" />
						<p className="text-lg font-medium text-gray-700">Drop files to upload</p>
					</div>
				</div>
			)}

			<ToastContainer toasts={toasts} onDismiss={removeToast} />
		</div>
	)
}

export default function FileBrowser() {
	return (
		<QueryClientProvider client={queryClient}>
			<FileBrowserInner />
		</QueryClientProvider>
	)
}
