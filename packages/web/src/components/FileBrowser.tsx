import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	FolderPlus,
	LayoutGrid,
	List,
	Loader2,
	LogOut,
	RefreshCw,
	Settings,
	Shield,
	Upload,
	UploadCloud,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCreateDirectory, useDeleteFile, useFiles } from '../hooks/useFiles'
import { useUpload } from '../hooks/useUpload'
import type { FileEntry } from '../lib/api'
import { BASE_PATH, withBase } from '../lib/basePath'
import { getFilesFromDataTransfer } from '../lib/drop'
import Breadcrumbs from './Breadcrumbs'
import FileGrid from './FileGrid'
import FileList from './FileList'
import PreviewModal from './PreviewModal'
import SearchBar from './SearchBar'
import ShareDialog from './ShareDialog'
import UploadProgress from './UploadProgress'
import UploadZone from './UploadZone'
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
	const navigateTo = useCallback((newPath: string) => {
		// Read volume fresh from current locationPath to avoid stale closures
		const { volume: currentVol } = parsePath(
			typeof window !== 'undefined' ? window.location.pathname : '/volumes',
		)
		const url = buildUrl(currentVol, newPath)
		history.pushState(null, '', url)
		setLocationPath(url)
		setPreviewFile(null)
	}, [])

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

	const handleNewFolder = useCallback(() => {
		const name = prompt('New folder name:')
		if (name) {
			mkdirMutation.mutate(name)
		}
	}, [mkdirMutation])

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
		<div className="max-w-6xl mx-auto px-4 py-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-2.5">
					<img src="/logo.png" alt="MiniNAS" className="w-8 h-8" />
					<h1 className="text-xl font-semibold text-gray-900">MiniNAS</h1>
				</div>
				<div className="flex items-center gap-4">
					<VolumeSelector selectedVolume={volume} onSelect={handleVolumeSelect} />
					{user?.role === 'admin' && (
						<a
							href={withBase('/admin')}
							className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
							title="Admin"
						>
							<Shield size={18} />
						</a>
					)}
					<a
						href={withBase('/settings')}
						className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
						title="Settings"
					>
						<Settings size={18} />
					</a>
					<button
						type="button"
						onClick={logout}
						className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
						onClick={() => refetch()}
						className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
						title="Refresh"
					>
						<RefreshCw size={16} />
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

			{/* Content */}
			{!volume ? (
				<div className="text-center py-20 text-gray-400">Select a volume to get started</div>
			) : isLoading ? (
				<div className="flex items-center justify-center py-20 text-gray-400">
					<Loader2 size={24} className="animate-spin" />
				</div>
			) : error ? (
				<div className="text-center py-20 text-red-500">
					Error loading files: {(error as Error).message}
				</div>
			) : viewMode === 'list' ? (
				<FileList
					entries={data?.entries || []}
					volume={volume}
					onNavigate={navigateTo}
					onDelete={(path) => deleteMutation.mutate(path)}
					onPreview={setPreviewFile}
					onShare={setShareFile}
				/>
			) : (
				<FileGrid
					entries={data?.entries || []}
					volume={volume}
					onNavigate={navigateTo}
					onPreview={setPreviewFile}
				/>
			)}
			{/* Preview Modal */}
			{previewFile && (
				<PreviewModal file={previewFile} volume={volume} onClose={() => setPreviewFile(null)} />
			)}

			{/* Share Dialog */}
			{shareFile && (
				<ShareDialog file={shareFile} volume={volume} onClose={() => setShareFile(null)} />
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
