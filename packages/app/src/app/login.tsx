import { useRouter } from 'expo-router'
import { Fingerprint, Loader2 } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { APP_NAME } from '@/lib/config'
import { authenticatePasskey } from '@/lib/passkeys'
import { Colors, Outlines, Sizing } from '@/theme'

export default function LoginScreen() {
	const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
	const [error, setError] = useState('')
	const router = useRouter()
	const insets = useSafeAreaInsets()

	const handleLogin = async () => {
		setStatus('loading')
		setError('')
		try {
			const verified = await authenticatePasskey()
			if (verified) {
				router.replace('/')
			} else {
				setStatus('error')
				setError('Authentication was not verified')
			}
		} catch (err) {
			setStatus('error')
			setError(err instanceof Error ? err.message : 'Authentication failed')
		}
	}

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<View style={styles.inner}>
				<View style={styles.heading}>
					<Text style={styles.title}>{APP_NAME}</Text>
					<Text style={styles.subtitle}>Sign in with your passkey</Text>
				</View>

				<View style={styles.card}>
					<Pressable
						onPress={handleLogin}
						disabled={status === 'loading'}
						style={[styles.loginButton, status === 'loading' && styles.loginButtonDisabled]}
					>
						{status === 'loading' ? (
							<ActivityIndicator size="small" color="#fff" />
						) : (
							<Fingerprint size={20} color="#fff" />
						)}
						<Text style={styles.loginButtonText}>
							{status === 'loading' ? 'Waiting for device...' : 'Sign In'}
						</Text>
					</Pressable>

					{error ? <Text style={styles.error}>{error}</Text> : null}
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.BackgroundColor.secondary,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: Sizing.gutters.base,
	},
	inner: {
		maxWidth: 400,
		width: '100%',
	},
	heading: {
		alignItems: 'center',
		marginBottom: 32,
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: Colors.TextColor.primary,
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 16,
		color: Colors.TextColor.secondary,
	},
	card: {
		backgroundColor: Colors.BackgroundColor.primary,
		borderWidth: Outlines.borderWidth.normal,
		borderColor: Colors.BorderColor.primary,
		borderRadius: Outlines.borderRadius.lg,
		padding: 24,
		...Outlines.shadow.sm,
	},
	loginButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		paddingVertical: 14,
		backgroundColor: Colors.BrandColor[600],
		borderRadius: Outlines.borderRadius.lg,
	},
	loginButtonDisabled: {
		opacity: 0.5,
	},
	loginButtonText: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '500',
	},
	error: {
		marginTop: 12,
		fontSize: 14,
		color: Colors.StatusColor.error,
		textAlign: 'center',
	},
})
