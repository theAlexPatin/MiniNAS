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
import type { FileEntry } from './api'

const iconColorMap: Record<string, string> = {
	folder: 'text-blue-500',
	image: 'text-purple-500',
	video: 'text-pink-500',
	audio: 'text-green-500',
	text: 'text-amber-500',
	archive: 'text-orange-500',
	code: 'text-cyan-600',
	default: 'text-gray-400',
}

function getFileCategory(entry: FileEntry): string {
	if (entry.isDirectory) return 'folder'
	const mime = entry.mimeType || ''
	if (mime.startsWith('image/')) return 'image'
	if (mime.startsWith('video/')) return 'video'
	if (mime.startsWith('audio/')) return 'audio'
	if (mime.startsWith('text/')) return 'text'
	if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip') || mime.includes('rar'))
		return 'archive'
	if (mime.includes('json') || mime.includes('javascript') || mime.includes('xml')) return 'code'
	return 'default'
}

const iconComponents: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
	folder: Folder,
	image: FileImage,
	video: FileVideo,
	audio: FileAudio,
	text: FileText,
	archive: FileArchive,
	code: FileCode,
	default: File,
}

export function getFileIcon(entry: FileEntry, size = 20) {
	const category = getFileCategory(entry)
	const Icon = iconComponents[category]
	const color = iconColorMap[category]
	return <Icon size={size} className={color} />
}

export function hasThumbnailSupport(entry: FileEntry): boolean {
	const mime = entry.mimeType || ''
	return mime.startsWith('image/') || mime.startsWith('video/')
}
