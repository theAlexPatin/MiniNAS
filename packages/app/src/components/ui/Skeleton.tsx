import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { Colors, Outlines } from '@/theme'

function Skeleton({ width, height, style }: { width?: number | string; height?: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { opacity, width: width ?? '100%', height: height ?? 16 },
        style,
      ]}
    />
  )
}

export function FileListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <View>
      <View style={styles.headerRow}>
        <Skeleton width={48} height={16} />
        <Skeleton width={64} height={16} />
        <Skeleton width={96} height={16} />
      </View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={20} height={20} style={styles.iconPlaceholder} />
          <Skeleton width={180} height={16} style={{ flex: 1 }} />
          <Skeleton width={64} height={14} />
        </View>
      ))}
    </View>
  )
}

export function FileGridSkeleton({ items = 10 }: { items?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: items }).map((_, i) => (
        <View key={i} style={styles.gridItem}>
          <Skeleton width={56} height={56} style={{ borderRadius: Outlines.borderRadius.lg }} />
          <Skeleton width={64} height={12} />
          <Skeleton width={40} height={10} />
        </View>
      ))}
    </View>
  )
}

export default Skeleton

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.BorderColor.primary,
    borderRadius: Outlines.borderRadius.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BorderColor.primary,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.BorderColor.secondary,
    paddingHorizontal: 12,
  },
  iconPlaceholder: {
    borderRadius: Outlines.borderRadius.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    width: '30%',
  },
})
