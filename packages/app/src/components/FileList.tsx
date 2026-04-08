import { ArrowDown, ArrowUp, ArrowUpDown, Download, Folder, Trash2 } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import EmptyState from '@/components/ui/EmptyState'
import type { FileEntry } from '@/lib/api'
import { api } from '@/lib/api'
import { getFileIcon, hasThumbnailSupport } from '@/lib/fileIcons'
import { formatBytes, formatDate, formatDateShort } from '@/lib/format'
import { Colors, Outlines, Typography } from '@/theme'

type SortField = 'name' | 'size' | 'modified'
type SortDir = 'asc' | 'desc'

interface FileListProps {
	entries: FileEntry[]
	volume: string
	onNavigate: (path: string) => void
	onDelete: (path: string) => void
	onPreview?: (file: FileEntry) => void
	onShare?: (file: FileEntry) => void
	selectable?: boolean
	selected?: Set<string>
	onToggle?: (path: string) => void
	onShiftSelect?: (paths: string[]) => void
	lastToggled?: string | null
	onSelectAll?: (paths: string[]) => void
}

function FileListRow({
	entry,
	volume,
	onNavigate,
	onDelete,
	onPreview,
	selectable,
	isSelected,
	onToggle,
}: {
	entry: FileEntry
	volume: string
	onNavigate: (path: string) => void
	onDelete: (path: string) => void
	onPreview?: (file: FileEntry) => void
	selectable?: boolean
	isSelected?: boolean
	onToggle?: (path: string) => void
}) {
	const [thumbError, setThumbError] = useState(false)
	const showThumb = hasThumbnailSupport(entry) && !thumbError

	const handlePress = () => {
		if (entry.isDirectory) {
			onNavigate(entry.path)
		} else if (onPreview) {
			onPreview(entry)
		}
	}

	const handleDelete = () => {
		Alert.alert('Delete', `Delete "${entry.name}"?`, [
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.path) },
		])
	}

	return (
		<Pressable onPress={handlePress} style={[styles.row, isSelected && styles.rowSelected]}>
			{selectable && (
				<Pressable onPress={() => onToggle?.(entry.path)} style={styles.checkbox} hitSlop={8}>
					<View style={[styles.checkboxBox, isSelected && styles.checkboxChecked]}>
						{isSelected && <Text style={styles.checkmark}>✓</Text>}
					</View>
				</Pressable>
			)}
			<View style={styles.nameCell}>
				{showThumb ? (
					<Image
						source={{ uri: api.getPreviewUrl(volume, entry.path, 'small') }}
						style={styles.thumbnail}
						onError={() => setThumbError(true)}
					/>
				) : (
					<View style={styles.iconWrap}>{getFileIcon(entry)}</View>
				)}
				<View style={styles.nameText}>
					<Text style={styles.fileName} numberOfLines={1}>
						{entry.name}
					</Text>
					<Text style={styles.fileMeta} numberOfLines={1}>
						{entry.isDirectory
							? formatDateShort(entry.modifiedAt)
							: `${formatBytes(entry.size)} · ${formatDateShort(entry.modifiedAt)}`}
					</Text>
				</View>
			</View>
			<Pressable onPress={handleDelete} style={styles.actionBtn} hitSlop={8}>
				<Trash2 size={16} color={Colors.TextColor.tertiary} />
			</Pressable>
		</Pressable>
	)
}

export default function FileList({
	entries,
	volume,
	onNavigate,
	onDelete,
	onPreview,
	onShare,
	selectable,
	selected,
	onToggle,
	onShiftSelect,
	lastToggled,
	onSelectAll,
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
		const color = sortField === field ? Colors.TextColor.secondary : Colors.TextColor.tertiary
		if (sortField !== field) return <ArrowUpDown size={14} color={color} />
		return sortDir === 'asc' ? (
			<ArrowUp size={14} color={color} />
		) : (
			<ArrowDown size={14} color={color} />
		)
	}

	return (
		<View>
			{/* Header */}
			<View style={styles.header}>
				{selectable && <View style={{ width: 32 }} />}
				<Pressable onPress={() => toggleSort('name')} style={styles.sortBtn}>
					<Text style={styles.headerText}>Name</Text>
					<SortIcon field="name" />
				</Pressable>
				<Pressable onPress={() => toggleSort('size')} style={styles.sortBtn}>
					<Text style={styles.headerText}>Size</Text>
					<SortIcon field="size" />
				</Pressable>
			</View>

			{/* Rows */}
			{sortedEntries.map((entry) => (
				<FileListRow
					key={entry.path}
					entry={entry}
					volume={volume}
					onNavigate={onNavigate}
					onDelete={onDelete}
					onPreview={onPreview}
					selectable={selectable}
					isSelected={selected?.has(entry.path)}
					onToggle={onToggle}
				/>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingBottom: 8,
		borderBottomWidth: 1,
		borderBottomColor: Colors.BorderColor.primary,
		paddingHorizontal: 12,
		gap: 8,
	},
	sortBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	headerText: {
		fontSize: 12,
		fontWeight: '500',
		color: Colors.TextColor.secondary,
		fontFamily: Typography.caption.fontFamily,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.BorderColor.secondary,
	},
	rowSelected: {
		backgroundColor: '#eff6ff',
	},
	checkbox: {
		marginRight: 8,
	},
	checkboxBox: {
		width: 18,
		height: 18,
		borderRadius: 4,
		borderWidth: 1.5,
		borderColor: Colors.BorderColor.primary,
		alignItems: 'center',
		justifyContent: 'center',
	},
	checkboxChecked: {
		backgroundColor: Colors.BrandColor[600],
		borderColor: Colors.BrandColor[600],
	},
	checkmark: {
		color: '#ffffff',
		fontSize: 12,
		fontWeight: '700',
	},
	nameCell: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	iconWrap: {
		width: 32,
		height: 32,
		alignItems: 'center',
		justifyContent: 'center',
	},
	thumbnail: {
		width: 32,
		height: 32,
		borderRadius: 4,
		backgroundColor: Colors.BackgroundColor.tertiary,
	},
	nameText: {
		flex: 1,
	},
	fileName: {
		fontSize: 14,
		color: Colors.TextColor.primary,
		fontFamily: Typography.body.fontFamily,
	},
	fileMeta: {
		fontSize: 11,
		color: Colors.TextColor.tertiary,
		marginTop: 1,
	},
	actionBtn: {
		padding: 8,
		marginLeft: 8,
	},
})
