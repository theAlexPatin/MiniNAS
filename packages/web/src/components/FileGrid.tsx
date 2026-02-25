import { Folder } from 'lucide-react'
import { useCallback, useRef } from 'react'
import type { FileEntry } from '../lib/api'
import { getFileIcon, hasThumbnailSupport } from '../lib/fileIcons'
import EmptyState from './ui/EmptyState'

function formatBytes(bytes: number): string {
	if (bytes === 0) return ''
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

interface FileGridProps {
	entries: FileEntry[]
	volume: string
	onNavigate: (path: string) => void
	onPreview?: (file: FileEntry) => void
	onContextMenu?: (file: FileEntry, x: number, y: number) => void
}

function FileGridItem({
	entry,
	volume,
	onNavigate,
	onPreview,
	onContextMenu,
}: {
	entry: FileEntry
	volume: string
	onNavigate: (path: string) => void
	onPreview?: (file: FileEntry) => void
	onContextMenu?: (file: FileEntry, x: number, y: number) => void
}) {
	const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const handleTouchStart = useCallback(
		(e: React.TouchEvent) => {
			if (!onContextMenu) return
			const touch = e.touches[0]
			longPressTimer.current = setTimeout(() => {
				onContextMenu(entry, touch.clientX, touch.clientY)
			}, 500)
		},
		[entry, onContextMenu],
	)

	const handleTouchEnd = useCallback(() => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current)
			longPressTimer.current = null
		}
	}, [])

	const handleRightClick = useCallback(
		(e: React.MouseEvent) => {
			if (!onContextMenu) return
			e.preventDefault()
			onContextMenu(entry, e.clientX, e.clientY)
		},
		[entry, onContextMenu],
	)

	return (
		<button
			type="button"
			onClick={() => {
				if (entry.isDirectory) {
					onNavigate(entry.path)
				} else if (onPreview) {
					onPreview(entry)
				}
			}}
			onContextMenu={handleRightClick}
			onTouchStart={handleTouchStart}
			onTouchEnd={handleTouchEnd}
			onTouchMove={handleTouchEnd}
			className="flex flex-col items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg hover:bg-gray-100 transition-colors group text-center"
		>
			<div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-lg bg-gray-100">
				{hasThumbnailSupport(entry) ? (
					<img
						src={`/api/v1/preview/${encodeURIComponent(volume)}/${entry.path.split('/').map(encodeURIComponent).join('/')}?size=small`}
						alt=""
						className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg"
						onError={(e) => {
							;(e.target as HTMLImageElement).style.display = 'none'
							;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
						}}
					/>
				) : null}
				<span className={hasThumbnailSupport(entry) ? 'hidden' : ''}>
					{getFileIcon(entry, 32)}
				</span>
			</div>
			<div className="w-full min-w-0">
				<p className="text-xs sm:text-sm truncate text-gray-900">{entry.name}</p>
				{!entry.isDirectory && (
					<p className="text-xs text-gray-400">{formatBytes(entry.size)}</p>
				)}
			</div>
		</button>
	)
}

export default function FileGrid({
	entries,
	volume,
	onNavigate,
	onPreview,
	onContextMenu,
}: FileGridProps) {
	if (entries.length === 0) {
		return <EmptyState icon={Folder} title="This folder is empty" />
	}

	return (
		<div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
			{entries.map((entry) => (
				<FileGridItem
					key={entry.path}
					entry={entry}
					volume={volume}
					onNavigate={onNavigate}
					onPreview={onPreview}
					onContextMenu={onContextMenu}
				/>
			))}
		</div>
	)
}
