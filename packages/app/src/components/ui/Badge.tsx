import { StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native'
import { Colors, Outlines, Typography } from '@/theme'

const variantStyles: Record<string, { container: ViewStyle; text: TextStyle }> = {
	default: {
		container: { backgroundColor: Colors.BackgroundColor.tertiary },
		text: { color: Colors.TextColor.secondary },
	},
	primary: {
		container: { backgroundColor: Colors.BrandColor[50] },
		text: { color: Colors.BrandColor[700] },
	},
	success: {
		container: { backgroundColor: Colors.StatusColor.successLight },
		text: { color: Colors.StatusColor.success },
	},
	warning: {
		container: { backgroundColor: Colors.StatusColor.warningLight },
		text: { color: Colors.StatusColor.warning },
	},
	error: {
		container: { backgroundColor: Colors.StatusColor.errorLight },
		text: { color: Colors.StatusColor.error },
	},
	info: {
		container: { backgroundColor: Colors.StatusColor.infoLight },
		text: { color: Colors.StatusColor.info },
	},
}

interface BadgeProps {
	variant?: keyof typeof variantStyles
	children: React.ReactNode
}

export default function Badge({ variant = 'default', children }: BadgeProps) {
	const vStyle = variantStyles[variant]
	return (
		<View style={[styles.container, vStyle.container]}>
			<Text style={[styles.text, vStyle.text]}>{children}</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: Outlines.borderRadius.sm,
		alignSelf: 'flex-start',
	},
	text: {
		fontSize: 11,
		fontWeight: '600',
		fontFamily: Typography.caption.fontFamily,
	},
})
