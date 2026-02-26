import { Linking, Modal, Pressable, StyleSheet, Text, View, Image, Platform } from 'react-native'
import { Download, X } from 'lucide-react-native'
import { api, type FileEntry } from '@/lib/api'
import { Colors, Outlines, Typography } from '@/theme'

interface PreviewModalProps {
  file: FileEntry
  volume: string
  onClose: () => void
}

export default function PreviewModal({ file, volume, onClose }: PreviewModalProps) {
  const downloadUrl = api.getDownloadUrl(volume, file.path)
  const inlineUrl = api.getInlineUrl(volume, file.path)
  const mime = file.mimeType || ''

  const handleDownload = () => {
    Linking.openURL(downloadUrl)
  }

  const renderContent = () => {
    if (mime.startsWith('image/')) {
      return (
        <Image
          source={{ uri: inlineUrl }}
          style={styles.imagePreview}
          resizeMode="contain"
        />
      )
    }

    return (
      <View style={styles.noPreview}>
        <Text style={styles.noPreviewText}>Preview not available for this file type</Text>
        <Pressable onPress={handleDownload} style={styles.downloadBtn}>
          <Download size={16} color="#ffffff" />
          <Text style={styles.downloadBtnText}>Download</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{file.name}</Text>
            <View style={styles.headerActions}>
              <Pressable onPress={handleDownload} style={styles.headerBtn} hitSlop={8}>
                <Download size={16} color={Colors.TextColor.tertiary} />
              </Pressable>
              <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
                <X size={16} color={Colors.TextColor.tertiary} />
              </Pressable>
            </View>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {renderContent()}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: Outlines.borderRadius.lg,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    overflow: 'hidden',
    ...Outlines.shadow.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BorderColor.primary,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.TextColor.primary,
    marginRight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    padding: 6,
    borderRadius: Outlines.borderRadius.sm,
  },
  body: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 400,
  },
  noPreview: {
    padding: 32,
    alignItems: 'center',
  },
  noPreviewText: {
    fontSize: 14,
    color: Colors.TextColor.secondary,
    marginBottom: 16,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.BrandColor[600],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Outlines.borderRadius.md,
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
})
