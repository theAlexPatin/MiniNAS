import { StyleSheet, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { Colors, Typography } from '@/theme'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon size={48} color={Colors.BorderColor.primary} />
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  title: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Typography.body.fontFamily,
    color: Colors.TextColor.secondary,
  },
  description: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.TextColor.tertiary,
    textAlign: 'center',
    maxWidth: 280,
  },
  action: {
    marginTop: 16,
  },
})
