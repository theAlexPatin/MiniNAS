import {
	File,
	FileArchive,
	FileAudio,
	FileCode,
	FileImage,
	FileText,
	FileVideo,
	Folder,
} from 'lucide-react'
import type { FileEntry } from '../lib/api'
import { api } from '../lib/api'

function formatBytes(bytes: number): string {
	if (bytes === 0) return ''
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(entry: FileEntry, size: number) {
	if (entry.isDirectory) return <Folder size={size} className="text-blue-500" />
	const mime = entry.mimeType || ''
	if (mime.startsWith('image/')) return <FileImage size={size} className="text-purple-500" />
	if (mime.startsWith('video/')) return <FileVideo size={size} className="text-pink-500" />
	if (mime.startsWith('audio/')) return <FileAudio size={size} className="text-green-500" />
	if (mime.startsWith('text/')) return <FileText size={size} className="text-amber-500" />
	if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip'))
		return <FileArchive size={size} className="text-orange-500" />
	if (mime.includes('json') || mime.includes('javascript') || mime.includes('xml'))
		return <FileCode size={size} className="text-cyan-600" />
	return <File size={size} className="text-gray-400" />
}

function hasThumbnailSupport(entry: FileEntry): boolean {
	const mime = entry.mimeType || ''
	return mime.startsWith('image/') || mime.startsWith('video/')
}

interface FileGridProps {
	entries: FileEntry[]
	volume: string
	onNavigate: (path: string) => void
	onPreview?: (file: FileEntry) => void
}

export default function FileGrid({ entries, volume, onNavigate, onPreview }: FileGridProps) {
	if (entries.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-gray-400">
				<Folder size={48} className="mb-3 opacity-50" />
				<p>This folder is empty</p>
			</div>
		)
	}

	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
					className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors group text-center"
				>
					<div className="w-16 h-16 flex items-center justify-center rounded-lg bg-gray-100">
						{hasThumbnailSupport(entry) ? (
							<img
								src={`/api/v1/preview/${encodeURIComponent(volume)}/${entry.path.split('/').map(encodeURIComponent).join('/')}?size=small`}
								alt=""
								className="w-16 h-16 object-cover rounded-lg"
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
						<p className="text-sm truncate text-gray-900">{entry.name}</p>
						{!entry.isDirectory && (
							<p className="text-xs text-gray-400">{formatBytes(entry.size)}</p>
						)}
					</div>
				</button>
			))}
		</div>
	)
}
