import { ArrowDown, ArrowUp, ArrowUpDown, Download, Folder, Link2, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { FileEntry } from '../lib/api'
import { api } from '../lib/api'
import { getFileIcon } from '../lib/fileIcons'
import EmptyState from './ui/EmptyState'

function formatBytes(bytes: number): string {
	if (bytes === 0) return '\u2014'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function formatDateShort(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
	})
}

type SortField = 'name' | 'size' | 'modified'
type SortDir = 'asc' | 'desc'

interface FileListProps {
	entries: FileEntry[]
	volume: string
	onNavigate: (path: string) => void
	onDelete: (path: string) => void
	onPreview?: (file: FileEntry) => void
	onShare?: (file: FileEntry) => void
	onContextMenu?: (file: FileEntry, x: number, y: number) => void
}

function FileListRow({
	entry,
	volume,
	onNavigate,
	onDelete,
	onPreview,
	onShare,
	onContextMenu,
}: {
	entry: FileEntry
	volume: string
	onNavigate: (path: string) => void
	onDelete: (path: string) => void
	onPreview?: (file: FileEntry) => void
	onShare?: (file: FileEntry) => void
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
		<tr
			className="border-b border-gray-100 hover:bg-blue-50/60 cursor-pointer group transition-colors"
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
		>
			<td className="py-3 sm:py-2.5 pl-3">
				<div className="flex items-center gap-2.5">
					{getFileIcon(entry)}
					<div className="min-w-0">
						<span className="truncate text-gray-900 block">{entry.name}</span>
						<span className="text-xs text-gray-400 sm:hidden">
							{entry.isDirectory
								? formatDateShort(entry.modifiedAt)
								: `${formatBytes(entry.size)} \u00B7 ${formatDateShort(entry.modifiedAt)}`}
						</span>
					</div>
				</div>
			</td>
			<td className="py-3 sm:py-2.5 text-gray-500 hidden sm:table-cell">
				{entry.isDirectory ? '\u2014' : formatBytes(entry.size)}
			</td>
			<td className="py-3 sm:py-2.5 text-gray-500 hidden sm:table-cell">
				{formatDate(entry.modifiedAt)}
			</td>
			<td className="py-3 sm:py-2.5 pr-3">
				<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
					{!entry.isDirectory && (
						<a
							href={api.getDownloadUrl(volume, entry.path)}
							onClick={(e) => e.stopPropagation()}
							className="p-2 sm:p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
							title="Download"
						>
							<Download size={16} />
						</a>
					)}
					{!entry.isDirectory && onShare && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation()
								onShare(entry)
							}}
							className="p-2 sm:p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600 transition-colors"
							title="Share"
						>
							<Link2 size={16} />
						</button>
					)}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							if (confirm(`Delete "${entry.name}"?`)) {
								onDelete(entry.path)
							}
						}}
						className="p-2 sm:p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
						title="Delete"
					>
						<Trash2 size={16} />
					</button>
				</div>
			</td>
		</tr>
	)
}

export default function FileList({
	entries,
	volume,
	onNavigate,
	onDelete,
	onPreview,
	onShare,
	onContextMenu,
}: FileListProps) {
	const [sortField, setSortField] = useState<SortField>('name')
	const [sortDir, setSortDir] = useState<SortDir>('asc')

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
		} else {
			setSortField(field)
			setSortDir('asc')
		}
	}

	const sortedEntries = useMemo(() => {
		const dirs = entries.filter((e) => e.isDirectory)
		const files = entries.filter((e) => !e.isDirectory)

		const compare = (a: FileEntry, b: FileEntry): number => {
			let result = 0
			switch (sortField) {
				case 'name':
					result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
					break
				case 'size':
					result = a.size - b.size
					break
				case 'modified':
					result = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
					break
			}
			return sortDir === 'asc' ? result : -result
		}

		return [...dirs.sort(compare), ...files.sort(compare)]
	}, [entries, sortField, sortDir])

	if (entries.length === 0) {
		return <EmptyState icon={Folder} title="This folder is empty" />
	}

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return <ArrowUpDown size={14} className="text-gray-300" />
		return sortDir === 'asc' ? (
			<ArrowUp size={14} className="text-gray-600" />
		) : (
			<ArrowDown size={14} className="text-gray-600" />
		)
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-gray-200 text-gray-500 text-left">
						<th className="pb-2 pl-3 font-medium">
							<button
								type="button"
								onClick={() => toggleSort('name')}
								className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
							>
								Name
								<SortIcon field="name" />
							</button>
						</th>
						<th className="pb-2 font-medium w-28 hidden sm:table-cell">
							<button
								type="button"
								onClick={() => toggleSort('size')}
								className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
							>
								Size
								<SortIcon field="size" />
							</button>
						</th>
						<th className="pb-2 font-medium w-44 hidden sm:table-cell">
							<button
								type="button"
								onClick={() => toggleSort('modified')}
								className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
							>
								Modified
								<SortIcon field="modified" />
							</button>
						</th>
						<th className="pb-2 font-medium w-20"></th>
					</tr>
				</thead>
				<tbody>
					{sortedEntries.map((entry) => (
						<FileListRow
							key={entry.path}
							entry={entry}
							volume={volume}
							onNavigate={onNavigate}
							onDelete={onDelete}
							onPreview={onPreview}
							onShare={onShare}
							onContextMenu={onContextMenu}
						/>
					))}
				</tbody>
			</table>
		</div>
	)
}
