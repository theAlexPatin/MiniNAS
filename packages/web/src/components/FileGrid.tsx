import { Folder } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { FileEntry } from '../lib/api'
import { api } from '../lib/api'
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
	selectable?: boolean
	selected?: Set<string>
	onToggle?: (path: string) => void
}

function FileGridItem({
	entry,
	volume,
	onNavigate,
	onPreview,
	onContextMenu,
	selectable,
	isSelected,
	onToggle,
}: {
	entry: FileEntry
	volume: string
	onNavigate: (path: string) => void
	onPreview?: (file: FileEntry) => void
	onContextMenu?: (file: FileEntry, x: number, y: number) => void
	selectable?: boolean
	isSelected?: boolean
	onToggle?: (path: string) => void
}) {
	const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [thumbError, setThumbError] = useState(false)

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

	const showThumb = hasThumbnailSupport(entry) && !thumbError

	return (
		<div className="relative">
			{selectable && (
				<div
					className={`absolute top-1 left-1 z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
				>
					<input
						type="checkbox"
						checked={isSelected}
						onChange={() => onToggle?.(entry.path)}
						className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
					/>
				</div>
			)}
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
				className={`w-full flex flex-col items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg hover:bg-gray-100 transition-colors group text-center ${isSelected ? 'bg-blue-50 ring-2 ring-brand-200' : ''}`}
			>
				<div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 flex items-center justify-center rounded-lg bg-gray-100 overflow-hidden">
					{showThumb ? (
						<img
							src={api.getPreviewUrl(volume, entry.path, 'medium')}
							alt=""
							className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 object-cover"
							onError={() => setThumbError(true)}
						/>
					) : (
						getFileIcon(entry, 32)
					)}
				</div>
				<div className="w-full min-w-0">
					<p className="text-xs sm:text-sm truncate text-gray-900">{entry.name}</p>
					{!entry.isDirectory && <p className="text-xs text-gray-400">{formatBytes(entry.size)}</p>}
				</div>
			</button>
		</div>
	)
}

export default function FileGrid({
	entries,
	volume,
	onNavigate,
	onPreview,
	onContextMenu,
	selectable,
	selected,
	onToggle,
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
					selectable={selectable}
					isSelected={selected?.has(entry.path)}
					onToggle={onToggle}
				/>
			))}
		</div>
	)
}
