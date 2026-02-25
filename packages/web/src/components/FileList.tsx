import { Download, Folder, Link2, Trash2 } from 'lucide-react'
import type { FileEntry } from '../lib/api'
import { api } from '../lib/api'
import { getFileIcon } from '../lib/fileIcons'

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

interface FileListProps {
	entries: FileEntry[]
	volume: string
	onNavigate: (path: string) => void
	onDelete: (path: string) => void
	onPreview?: (file: FileEntry) => void
	onShare?: (file: FileEntry) => void
}

export default function FileList({
	entries,
	volume,
	onNavigate,
	onDelete,
	onPreview,
	onShare,
}: FileListProps) {
	if (entries.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-gray-400">
				<Folder size={48} className="mb-3 opacity-50" />
				<p>This folder is empty</p>
			</div>
		)
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-gray-200 text-gray-500 text-left">
						<th className="pb-2 pl-3 font-medium">Name</th>
						<th className="pb-2 font-medium w-28">Size</th>
						<th className="pb-2 font-medium w-44">Modified</th>
						<th className="pb-2 font-medium w-20"></th>
					</tr>
				</thead>
				<tbody>
					{entries.map((entry) => (
						<tr
							key={entry.path}
							className="border-b border-gray-100 hover:bg-blue-50/60 cursor-pointer group transition-colors"
							onClick={() => {
								if (entry.isDirectory) {
									onNavigate(entry.path)
								} else if (onPreview) {
									onPreview(entry)
								}
							}}
						>
							<td className="py-3 sm:py-2.5 pl-3">
								<div className="flex items-center gap-2.5">
									{getFileIcon(entry)}
									<span className="truncate text-gray-900">{entry.name}</span>
								</div>
							</td>
							<td className="py-3 sm:py-2.5 text-gray-500">
								{entry.isDirectory ? '\u2014' : formatBytes(entry.size)}
							</td>
							<td className="py-3 sm:py-2.5 text-gray-500">{formatDate(entry.modifiedAt)}</td>
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
					))}
				</tbody>
			</table>
		</div>
	)
}
