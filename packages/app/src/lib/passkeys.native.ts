import { getApiBase } from './api'

function authBase() {
	return `${getApiBase()}/auth`
}

export async function registerPasskey(): Promise<boolean> {
	// TODO: Implement native passkey registration via ASAuthorizationController (iOS)
	// or FIDO2 API (Android) using an Expo module
	throw new Error(
		'Passkey registration is not yet implemented on native. Use the web app to register.',
	)
}

export async function authenticatePasskey(): Promise<boolean> {
	// TODO: Implement native passkey authentication
	throw new Error(
		'Passkey authentication is not yet implemented on native. Use the web app to sign in.',
	)
}

export async function checkSession(): Promise<{
	authenticated: boolean
	user: { id: string; username: string; role: string } | null
}> {
	const res = await fetch(`${authBase()}/session`, { credentials: 'include' })
	return res.json()
}

export async function checkSetupNeeded(): Promise<boolean> {
	const res = await fetch(`${authBase()}/setup-needed`, { credentials: 'include' })
	const data = await res.json()
	return data.setupNeeded
}

export async function logout(): Promise<void> {
	await fetch(`${authBase()}/logout`, {
		method: 'POST',
		credentials: 'include',
	})
}
