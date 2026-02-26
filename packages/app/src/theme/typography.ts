import { Platform } from 'react-native'

const fontFamily = Platform.select({
  ios: undefined, // System font (San Francisco)
  android: undefined, // System font (Roboto)
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
})

export const title = {
  fontSize: 24,
  fontWeight: '700' as const,
  fontFamily,
}

export const heading = {
  fontSize: 20,
  fontWeight: '600' as const,
  fontFamily,
}

export const body = {
  fontSize: 14,
  fontWeight: '400' as const,
  fontFamily,
}

export const bodySmall = {
  fontSize: 12,
  fontWeight: '400' as const,
  fontFamily,
}

export const caption = {
  fontSize: 11,
  fontWeight: '400' as const,
  fontFamily,
}

export const button = {
  fontSize: 14,
  fontWeight: '500' as const,
  fontFamily,
}

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
}
