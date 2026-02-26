import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { getApiBase } from './api'

function authBase() {
	return `${getApiBase()}/auth`
}

export async function registerPasskey(): Promise<boolean> {
	const optionsRes = await fetch(`${authBase()}/registration/options`, {
		credentials: 'include',
	})
	if (!optionsRes.ok) {
		const err = await optionsRes.json()
		throw new Error(err.error || 'Failed to get registration options')
	}
	const options = await optionsRes.json()

	const credential = await startRegistration({ optionsJSON: options })

	const verifyRes = await fetch(`${authBase()}/registration/verify`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(credential),
	})

	if (!verifyRes.ok) {
		const err = await verifyRes.json()
		throw new Error(err.error || 'Registration verification failed')
	}

	const result = await verifyRes.json()
	return result.verified
}

export async function authenticatePasskey(): Promise<boolean> {
	const optionsRes = await fetch(`${authBase()}/authentication/options`, {
		credentials: 'include',
	})
	if (!optionsRes.ok) {
		const err = await optionsRes.json()
		throw new Error(err.error || 'Failed to get authentication options')
	}
	const options = await optionsRes.json()

	const credential = await startAuthentication({ optionsJSON: options })

	const verifyRes = await fetch(`${authBase()}/authentication/verify`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(credential),
	})

	if (!verifyRes.ok) {
		const err = await verifyRes.json()
		throw new Error(err.error || 'Authentication failed')
	}

	const result = await verifyRes.json()
	return result.verified
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
