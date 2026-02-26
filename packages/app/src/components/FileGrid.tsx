import { useCallback, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Folder } from 'lucide-react-native'
import type { FileEntry } from '@/lib/api'
import { api } from '@/lib/api'
import { getFileIcon, hasThumbnailSupport } from '@/lib/fileIcons'
import { formatBytes } from '@/lib/format'
import EmptyState from '@/components/ui/EmptyState'
import { Colors, Outlines, Typography } from '@/theme'

interface FileGridProps {
  entries: FileEntry[]
  volume: string
  onNavigate: (path: string) => void
  onPreview?: (file: FileEntry) => void
  selectable?: boolean
  selected?: Set<string>
  onToggle?: (path: string) => void
  onShiftSelect?: (paths: string[]) => void
  lastToggled?: string | null
}

function FileGridItem({
  entry,
  volume,
  onNavigate,
  onPreview,
  selectable,
  isSelected,
  onToggle,
}: {
  entry: FileEntry
  volume: string
  onNavigate: (path: string) => void
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

  const handleLongPress = () => {
    onToggle?.(entry.path)
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={[styles.gridItem, isSelected && styles.gridItemSelected]}
    >
      {selectable && isSelected && (
        <View style={styles.checkOverlay}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        </View>
      )}
      <View style={styles.thumbContainer}>
        {showThumb ? (
          <Image
            source={{ uri: api.getPreviewUrl(volume, entry.path, 'medium') }}
            style={styles.thumbImage}
            onError={() => setThumbError(true)}
          />
        ) : (
          getFileIcon(entry, 32)
        )}
      </View>
      <Text style={styles.itemName} numberOfLines={1}>{entry.name}</Text>
      {!entry.isDirectory && (
        <Text style={styles.itemSize}>{formatBytes(entry.size)}</Text>
      )}
    </Pressable>
  )
}

export default function FileGrid({
  entries,
  volume,
  onNavigate,
  onPreview,
  selectable,
  selected,
  onToggle,
  onShiftSelect,
  lastToggled,
}: FileGridProps) {
  if (entries.length === 0) {
    return <EmptyState icon={Folder} title="This folder is empty" />
  }

  return (
    <View style={styles.grid}>
      {entries.map((entry) => (
        <FileGridItem
          key={entry.path}
          entry={entry}
          volume={volume}
          onNavigate={onNavigate}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '31%',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: Outlines.borderRadius.lg,
    position: 'relative',
  },
  gridItemSelected: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: Colors.BrandColor[200],
  },
  checkOverlay: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.BrandColor[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  thumbContainer: {
    width: 64,
    height: 64,
    borderRadius: Outlines.borderRadius.lg,
    backgroundColor: Colors.BackgroundColor.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: 64,
    height: 64,
  },
  itemName: {
    fontSize: 12,
    color: Colors.TextColor.primary,
    textAlign: 'center',
    fontFamily: Typography.body.fontFamily,
  },
  itemSize: {
    fontSize: 11,
    color: Colors.TextColor.tertiary,
  },
})
