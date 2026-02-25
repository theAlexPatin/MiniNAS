import { Folder } from 'lucide-react'
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
}

export default function FileGrid({ entries, volume, onNavigate, onPreview }: FileGridProps) {
	if (entries.length === 0) {
		return <EmptyState icon={Folder} title="This folder is empty" />
	}

	return (
		<div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
			{entries.map((entry) => (
				<button
					type="button"
					key={entry.path}
					onClick={() => {
						if (entry.isDirectory) {
							onNavigate(entry.path)
						} else if (onPreview) {
							onPreview(entry)
						}
					}}
					className="flex flex-col items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg hover:bg-gray-100 transition-colors group text-center"
				>
					<div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-lg bg-gray-100">
						{hasThumbnailSupport(entry) ? (
							<img
								src={`/api/v1/preview/${encodeURIComponent(volume)}/${entry.path.split('/').map(encodeURIComponent).join('/')}?size=small`}
								alt=""
								className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg"
								onError={(e) => {
									// Fallback to icon on error
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
			))}
		</div>
	)
}
