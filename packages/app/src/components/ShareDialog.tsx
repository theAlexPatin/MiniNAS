import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Check, Copy, Link2, X } from 'lucide-react-native'
import { type FileEntry, getApiBase } from '@/lib/api'
import { Colors, Outlines, Typography } from '@/theme'

interface ShareDialogProps {
  file: FileEntry
  volume: string
  onClose: () => void
}

export default function ShareDialog({ file, volume, onClose }: ShareDialogProps) {
  const [password, setPassword] = useState('')
  const [maxDownloads, setMaxDownloads] = useState('')
  const [expiresIn, setExpiresIn] = useState('24')
  const [shareUrl, setShareUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${getApiBase()}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volume,
          path: file.path,
          password: password || undefined,
          maxDownloads: maxDownloads ? parseInt(maxDownloads) : undefined,
          expiresIn: expiresIn ? parseInt(expiresIn) : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create share')
      }

      const data = await res.json()
      setShareUrl(data.url || `${getApiBase()}/share/${data.share.id}/download`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    await Clipboard.setStringAsync(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Share File</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color={Colors.TextColor.tertiary} />
            </Pressable>
          </View>

          <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>

          {shareUrl ? (
            <View style={styles.section}>
              <Text style={styles.label}>Share URL</Text>
              <View style={styles.urlRow}>
                <TextInput
                  value={shareUrl}
                  editable={false}
                  style={styles.urlInput}
                  selectTextOnFocus
                />
                <Pressable onPress={handleCopy} style={styles.copyBtn}>
                  {copied ? <Check size={16} color="#fff" /> : <Copy size={16} color="#fff" />}
                  <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.field}>
                <Text style={styles.label}>Password (optional)</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Leave empty for no password"
                  placeholderTextColor={Colors.TextColor.tertiary}
                  style={styles.textInput}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Max downloads (optional)</Text>
                <TextInput
                  value={maxDownloads}
                  onChangeText={setMaxDownloads}
                  placeholder="Unlimited"
                  placeholderTextColor={Colors.TextColor.tertiary}
                  keyboardType="number-pad"
                  style={styles.textInput}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                onPress={handleCreate}
                disabled={creating}
                style={[styles.createBtn, creating && styles.createBtnDisabled]}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Link2 size={16} color="#fff" />
                )}
                <Text style={styles.createBtnText}>Create Share Link</Text>
              </Pressable>
            </View>
          )}
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
  dialog: {
    backgroundColor: '#ffffff',
    borderRadius: Outlines.borderRadius.lg,
    width: '100%',
    maxWidth: 420,
    padding: 24,
    ...Outlines.shadow.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.TextColor.primary,
  },
  fileName: {
    fontSize: 13,
    color: Colors.TextColor.secondary,
    marginBottom: 16,
  },
  section: {
    gap: 12,
  },
  label: {
    fontSize: 12,
    color: Colors.TextColor.secondary,
    marginBottom: 4,
  },
  urlRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: Colors.BackgroundColor.secondary,
    borderWidth: 1,
    borderColor: Colors.BorderColor.primary,
    borderRadius: Outlines.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.TextColor.primary,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.BrandColor[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Outlines.borderRadius.md,
  },
  copyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  field: {
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.BorderColor.primary,
    borderRadius: Outlines.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.TextColor.primary,
  },
  errorText: {
    fontSize: 13,
    color: Colors.StatusColor.error,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.BrandColor[600],
    paddingVertical: 10,
    borderRadius: Outlines.borderRadius.md,
    marginTop: 4,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
})
