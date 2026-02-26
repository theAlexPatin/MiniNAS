import { useEffect } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, HardDrive } from 'lucide-react-native'
import { api, type VolumeInfo } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { Colors, Outlines, Typography } from '@/theme'

interface VolumeSelectorProps {
  selectedVolume: string
  onSelect: (volumeId: string) => void
}

export default function VolumeSelector({ selectedVolume, onSelect }: VolumeSelectorProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['volumes'],
    queryFn: () => api.getVolumes(),
  })

  const volumes = data?.volumes || []

  useEffect(() => {
    if (volumes.length > 0 && !selectedVolume) {
      onSelect(volumes[0].id)
    }
  }, [volumes, selectedVolume, onSelect])

  if (isLoading) {
    return (
      <View style={styles.container}>
        <HardDrive size={16} color={Colors.TextColor.tertiary} />
        <ActivityIndicator size="small" color={Colors.TextColor.tertiary} />
        <Text style={styles.loadingText}>Loading volumes...</Text>
      </View>
    )
  }

  if (volumes.length === 0) {
    return (
      <View style={styles.container}>
        <HardDrive size={16} color={Colors.TextColor.tertiary} />
        <Text style={styles.loadingText}>No volumes configured</Text>
      </View>
    )
  }

  const current = volumes.find((v) => v.id === selectedVolume)

  return (
    <View style={styles.container}>
      <HardDrive size={16} color={Colors.TextColor.tertiary} />
      <Text style={styles.volumeLabel} numberOfLines={1}>
        {current?.label ?? 'Select volume'}
      </Text>
      {current && (
        <Text style={styles.volumeSize}>
          {formatBytes(current.usedBytes)} / {formatBytes(current.totalBytes)}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.TextColor.tertiary,
  },
  volumeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.TextColor.primary,
    fontFamily: Typography.body.fontFamily,
    maxWidth: 160,
  },
  volumeSize: {
    fontSize: 12,
    color: Colors.TextColor.tertiary,
  },
})
