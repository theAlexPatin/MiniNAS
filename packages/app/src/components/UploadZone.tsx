import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { Upload } from 'lucide-react-native'
import { Colors, Outlines, Typography } from '@/theme'

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void
}

export default function UploadZone({ onFilesSelected }: UploadZoneProps) {
  const handlePickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets) {
        // On web, DocumentPicker returns File objects in the assets
        // On native, we get URI-based assets — wrap them for the upload hook
        const files = result.assets.map((asset) => {
          if (asset.file) return asset.file as File
          // Create a minimal File-like object for native
          return {
            name: asset.name,
            size: asset.size ?? 0,
            type: asset.mimeType ?? 'application/octet-stream',
            uri: asset.uri,
          } as unknown as File
        })
        onFilesSelected(files)
      }
    } catch (_err) {
      // User cancelled or error
    }
  }

  return (
    <View style={styles.container}>
      <Upload size={32} color={Colors.TextColor.tertiary} />
      <Text style={styles.text}>Select files to upload</Text>
      <Pressable onPress={handlePickFiles} style={styles.button}>
        <Text style={styles.buttonText}>Choose Files</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.BorderColor.primary,
    borderRadius: Outlines.borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  text: {
    fontSize: 14,
    color: Colors.TextColor.secondary,
  },
  button: {
    backgroundColor: Colors.BrandColor[600],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Outlines.borderRadius.md,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
})
