import { CheckCircle, Fingerprint, Loader2, ShieldX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { APP_NAME } from '../lib/appName'
import { withBase } from '../lib/basePath'
import { checkSetupNeeded, registerPasskey } from '../lib/passkeys'

export default function PasskeySetup() {
	const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
	const [error, setError] = useState('')
	const [setupDisabled, setSetupDisabled] = useState(false)
	const [checking, setChecking] = useState(true)

	useEffect(() => {
		checkSetupNeeded().then((needed) => {
			if (!needed) {
				setSetupDisabled(true)
			}
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
				setTimeout(() => {
					window.location.href = withBase('/')
				}, 1000)
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
			<div className="min-h-screen flex items-center justify-center px-4">
				<Loader2 size={32} className="animate-spin text-gray-400" />
			</div>
		)
	}

	if (setupDisabled) {
		return (
			<div className="min-h-screen flex items-center justify-center px-4">
				<div className="max-w-md w-full">
					<div className="text-center mb-8">
						<img src="/logo.png" alt={APP_NAME} className="w-24 h-24 mx-auto mb-4" />
						<h1 className="text-2xl font-bold mb-2 text-gray-900">Setup Unavailable</h1>
						<p className="text-gray-500">
							An admin account has already been configured. Setup can only be run once during
							initial installation.
						</p>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
						<div className="text-center py-4">
							<ShieldX size={48} className="mx-auto mb-3 text-red-400" />
							<p className="text-sm text-gray-500 mt-2">
								If you need to log in, go to the{' '}
								<a
									href={withBase('/login')}
									className="text-brand-600 hover:text-brand-700 font-medium"
								>
									login page
								</a>
								.
							</p>
						</div>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen flex items-center justify-center px-4">
			<div className="max-w-md w-full">
				<div className="text-center mb-8">
					<img src="/logo.png" alt={APP_NAME} className="w-24 h-24 mx-auto mb-4" />
					<h1 className="text-2xl font-bold mb-2 text-gray-900">Welcome to {APP_NAME}</h1>
					<p className="text-gray-500">
						Set up your passkey to secure your NAS. This will use your device's biometric
						authentication (Touch ID, Face ID, etc.)
					</p>
				</div>

				<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
					{status === 'success' ? (
						<div className="text-center py-4">
							<CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
							<p className="text-lg font-medium text-gray-900">Passkey registered!</p>
							<p className="text-gray-400 text-sm mt-1">Redirecting...</p>
						</div>
					) : (
						<>
							<button
								type="button"
								onClick={handleRegister}
								disabled={status === 'loading'}
								className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
							>
								{status === 'loading' ? (
									<Loader2 size={20} className="animate-spin" />
								) : (
									<Fingerprint size={20} />
								)}
								{status === 'loading' ? 'Waiting for device...' : 'Register Passkey'}
							</button>

							{error && <p className="mt-3 text-sm text-red-500 text-center">{error}</p>}
						</>
					)}
				</div>
			</div>
		</div>
	)
}
