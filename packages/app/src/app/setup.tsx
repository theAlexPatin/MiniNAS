import { useRouter } from 'expo-router'
import { CheckCircle, Fingerprint, ShieldX } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { APP_NAME } from '@/lib/config'
import { checkSetupNeeded, registerPasskey } from '@/lib/passkeys'
import { Colors, Outlines, Sizing } from '@/theme'

export default function SetupScreen() {
	const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
	const [error, setError] = useState('')
	const [setupDisabled, setSetupDisabled] = useState(false)
	const [checking, setChecking] = useState(true)
	const router = useRouter()
	const insets = useSafeAreaInsets()

	useEffect(() => {
		checkSetupNeeded().then((needed) => {
			if (!needed) setSetupDisabled(true)
			setChecking(false)
		})
	}, [])

	const handleRegister = async () => {
		setStatus('loading')
		setError('')
		try {
			const verified = await registerPasskey()
			if (verified) {
				setStatus('success')
				setTimeout(() => router.replace('/'), 1000)
			} else {
				setStatus('error')
				setError('Registration was not verified')
			}
		} catch (err) {
			setStatus('error')
			setError(err instanceof Error ? err.message : 'Registration failed')
		}
	}

	if (checking) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" color={Colors.TextColor.tertiary} />
			</View>
		)
	}

	if (setupDisabled) {
		return (
			<View style={[styles.centered, { paddingTop: insets.top }]}>
				<View style={styles.inner}>
					<View style={styles.heading}>
						<Text style={styles.title}>Setup Unavailable</Text>
						<Text style={styles.subtitle}>An admin account has already been configured.</Text>
					</View>
					<View style={styles.card}>
						<View style={styles.iconCenter}>
							<ShieldX size={48} color={Colors.StatusColor.error} />
						</View>
						<Text style={styles.helperText}>If you need to log in, go to the login page.</Text>
						<Pressable onPress={() => router.replace('/login')} style={styles.linkButton}>
							<Text style={styles.linkText}>Go to Login</Text>
						</Pressable>
					</View>
				</View>
			</View>
		)
	}

	return (
		<View style={[styles.centered, { paddingTop: insets.top }]}>
			<View style={styles.inner}>
				<View style={styles.heading}>
					<Text style={styles.title}>Welcome to {APP_NAME}</Text>
					<Text style={styles.subtitle}>
						Set up your passkey to secure your NAS. This will use your device's biometric
						authentication.
					</Text>
				</View>

				<View style={styles.card}>
					{status === 'success' ? (
						<View style={styles.iconCenter}>
							<CheckCircle size={48} color={Colors.StatusColor.success} />
							<Text style={styles.successTitle}>Passkey registered!</Text>
							<Text style={styles.helperText}>Redirecting...</Text>
						</View>
					) : (
						<>
							<Pressable
								onPress={handleRegister}
								disabled={status === 'loading'}
								style={[styles.primaryButton, status === 'loading' && styles.disabled]}
							>
								{status === 'loading' ? (
									<ActivityIndicator size="small" color="#fff" />
								) : (
									<Fingerprint size={20} color="#fff" />
								)}
								<Text style={styles.primaryButtonText}>
									{status === 'loading' ? 'Waiting for device...' : 'Register Passkey'}
								</Text>
							</Pressable>
							{error ? <Text style={styles.error}>{error}</Text> : null}
						</>
					)}
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	centered: {
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
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 16,
		color: Colors.TextColor.secondary,
		textAlign: 'center',
	},
	card: {
		backgroundColor: Colors.BackgroundColor.primary,
		borderWidth: Outlines.borderWidth.normal,
		borderColor: Colors.BorderColor.primary,
		borderRadius: Outlines.borderRadius.lg,
		padding: 24,
		...Outlines.shadow.sm,
	},
	iconCenter: {
		alignItems: 'center',
		paddingVertical: 16,
	},
	successTitle: {
		fontSize: 18,
		fontWeight: '500',
		color: Colors.TextColor.primary,
		marginTop: 12,
	},
	helperText: {
		fontSize: 14,
		color: Colors.TextColor.tertiary,
		textAlign: 'center',
		marginTop: 8,
	},
	primaryButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		paddingVertical: 14,
		backgroundColor: Colors.BrandColor[600],
		borderRadius: Outlines.borderRadius.lg,
	},
	primaryButtonText: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '500',
	},
	disabled: {
		opacity: 0.5,
	},
	error: {
		marginTop: 12,
		fontSize: 14,
		color: Colors.StatusColor.error,
		textAlign: 'center',
	},
	linkButton: {
		alignItems: 'center',
		marginTop: 16,
	},
	linkText: {
		fontSize: 14,
		fontWeight: '500',
		color: Colors.BrandColor[600],
	},
})
