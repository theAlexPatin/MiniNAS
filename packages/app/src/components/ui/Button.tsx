import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle, type TextStyle } from 'react-native'
import { Colors, Outlines, Typography } from '@/theme'

const variantStyles: Record<string, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: Colors.BrandColor[600] },
    text: { color: '#ffffff' },
  },
  secondary: {
    container: {
      backgroundColor: '#ffffff',
      borderWidth: Outlines.borderWidth.normal,
      borderColor: Colors.BorderColor.primary,
    },
    text: { color: Colors.TextColor.primary },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: Colors.TextColor.secondary },
  },
  danger: {
    container: { backgroundColor: Colors.StatusColor.error },
    text: { color: '#ffffff' },
  },
}

const sizeStyles: Record<string, { container: ViewStyle; text: TextStyle }> = {
  sm: { container: { paddingHorizontal: 8, paddingVertical: 4 }, text: { fontSize: 12 } },
  md: { container: { paddingHorizontal: 12, paddingVertical: 6 }, text: { fontSize: 13 } },
  lg: { container: { paddingHorizontal: 16, paddingVertical: 8 }, text: { fontSize: 14 } },
  icon: { container: { padding: 6 }, text: {} },
}

interface ButtonProps {
  variant?: keyof typeof variantStyles
  size?: keyof typeof sizeStyles
  loading?: boolean
  disabled?: boolean
  onPress?: () => void
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  onPress,
  children,
}: ButtonProps) {
  const isDisabled = disabled || loading
  const vStyle = variantStyles[variant]
  const sStyle = sizeStyles[size]

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        vStyle.container,
        sStyle.container,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={vStyle.text.color} style={styles.loader} />}
      {typeof children === 'string' ? (
        <Text style={[styles.text, vStyle.text, sStyle.text]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Outlines.borderRadius.md,
    gap: 6,
  },
  text: {
    fontFamily: Typography.button.fontFamily,
    fontWeight: Typography.button.fontWeight as TextStyle['fontWeight'],
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  loader: {
    marginRight: 4,
  },
})
