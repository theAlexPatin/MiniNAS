import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Folder,
} from 'lucide-react-native'
import type { FileEntry } from './api'

const iconColorMap: Record<string, string> = {
  folder: '#3b82f6',
  image: '#a855f7',
  video: '#ec4899',
  audio: '#22c55e',
  text: '#f59e0b',
  archive: '#f97316',
  code: '#0891b2',
  default: '#9ca3af',
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

const iconComponents: Record<string, typeof File> = {
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
  return <Icon size={size} color={color} />
}

export function hasThumbnailSupport(entry: FileEntry): boolean {
  const mime = entry.mimeType || ''
  return mime.startsWith('image/') || mime.startsWith('video/')
}
