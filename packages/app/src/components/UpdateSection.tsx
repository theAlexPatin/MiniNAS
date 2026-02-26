import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Package, RefreshCw } from 'lucide-react-native'
import { api } from '@/lib/api'
import { APP_NAME } from '@/lib/config'
import Button from '@/components/ui/Button'
import { Colors, Outlines, Typography } from '@/theme'

export default function UpdateSection() {
  const [restarting, setRestarting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['version'],
    queryFn: () => api.getVersion(),
  })

  useEffect(() => {
    if (!restarting) return

    const startDelay = setTimeout(() => {
      pollRef.current = setInterval(async () => {
        try {
          await api.getVersion()
          // Server is back — would reload on web
          setRestarting(false)
        } catch {
          // Still down
        }
      }, 2000)
    }, 3000)

    return () => {
      clearTimeout(startDelay)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [restarting])

  const updateMutation = useMutation({
    mutationFn: () => api.triggerUpdate(),
    onSuccess: () => setRestarting(true),
  })

  const handleUpdate = () => {
    Alert.alert(
      'Update',
      `Update ${APP_NAME} and restart the server?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Update', onPress: () => updateMutation.mutate() },
      ],
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Package size={18} color={Colors.TextColor.primary} />
        <Text style={styles.heading}>Software Update</Text>
      </View>

      <View style={styles.body}>
        <View>
          <Text style={styles.label}>
            Current version:{' '}
            {isLoading ? (
              <Text style={styles.loadingText}>loading...</Text>
            ) : (
              <Text style={styles.versionText}>{data?.version || 'unknown'}</Text>
            )}
          </Text>
        </View>

        {restarting ? (
          <View style={styles.restartingRow}>
            <ActivityIndicator size="small" color="#d97706" />
            <Text style={styles.restartingText}>Restarting...</Text>
          </View>
        ) : (
          <Button onPress={handleUpdate} loading={updateMutation.isPending}>
            <RefreshCw size={16} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '500' }}>Update & Restart</Text>
          </Button>
        )}
      </View>

      {updateMutation.isError && (
        <Text style={styles.errorText}>
          Failed to trigger update. Is {APP_NAME} installed via Homebrew?
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.BorderColor.primary,
    borderRadius: Outlines.borderRadius.lg,
    padding: 20,
    ...Outlines.shadow.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  heading: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.TextColor.primary,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    color: Colors.TextColor.secondary,
  },
  loadingText: {
    color: Colors.TextColor.tertiary,
  },
  versionText: {
    fontFamily: Typography.caption.fontFamily,
    fontWeight: '500',
    color: Colors.TextColor.primary,
  },
  restartingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restartingText: {
    fontSize: 13,
    color: '#d97706',
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.StatusColor.error,
  },
})
