import { AlertCircle, CheckCircle, Info, X } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native'
import type { Toast as ToastType } from '@/hooks/useToast'
import { Colors, Outlines } from '@/theme'

const typeConfig: Record<
	ToastType['type'],
	{ bg: string; border: string; text: string; Icon: typeof CheckCircle }
> = {
	success: {
		bg: Colors.StatusColor.successLight,
		border: '#a7f3d0',
		text: '#065f46',
		Icon: CheckCircle,
	},
	error: {
		bg: Colors.StatusColor.errorLight,
		border: '#fecaca',
		text: '#991b1b',
		Icon: AlertCircle,
	},
	info: {
		bg: Colors.StatusColor.infoLight,
		border: '#bfdbfe',
		text: '#1e40af',
		Icon: Info,
	},
}

interface ToastContainerProps {
	toasts: ToastType[]
	onDismiss: (id: string) => void
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
	if (toasts.length === 0) return null

	return (
		<View style={styles.container}>
			{toasts.map((toast) => {
				const config = typeConfig[toast.type]
				const Icon = config.Icon
				return (
					<View
						key={toast.id}
						style={[styles.toast, { backgroundColor: config.bg, borderColor: config.border }]}
					>
						<Icon size={18} color={config.text} />
						<Text style={[styles.message, { color: config.text }]}>{toast.message}</Text>
						<Pressable onPress={() => onDismiss(toast.id)} hitSlop={8}>
							<X size={14} color={config.text} />
						</Pressable>
					</View>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		top: 16,
		right: 16,
		left: 16,
		zIndex: 50,
		gap: 8,
	},
	toast: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderRadius: Outlines.borderRadius.lg,
		borderWidth: 1,
		...Outlines.shadow.md,
	},
	message: {
		flex: 1,
		fontSize: 13,
	},
})
