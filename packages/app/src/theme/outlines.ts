import { Platform, StyleSheet } from 'react-native'

export const borderRadius = {
	sm: 6,
	md: 8,
	lg: 12,
	xl: 16,
	xxl: 24,
	full: 9999,
} as const

export const borderWidth = {
	thin: StyleSheet.hairlineWidth,
	normal: 1,
} as const

function makeShadow(offsetY: number, radius: number, opacity: number, elevation: number) {
	if (Platform.OS === 'android') {
		return { elevation }
	}
	return {
		shadowColor: '#000',
		shadowOffset: { width: 0, height: offsetY },
		shadowOpacity: opacity,
		shadowRadius: radius,
	}
}

export const shadow = {
	sm: makeShadow(1, 2, 0.05, 1),
	md: makeShadow(2, 4, 0.1, 3),
	lg: makeShadow(4, 8, 0.15, 6),
	xl: makeShadow(8, 16, 0.2, 10),
} as const
