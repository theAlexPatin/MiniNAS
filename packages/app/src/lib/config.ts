import { Platform } from 'react-native'

declare global {
	interface Window {
		__BASE_PATH__?: string
		__APP_NAME__?: string
	}
}

export const BASE_PATH: string =
	Platform.OS === 'web' && typeof window !== 'undefined' ? (window.__BASE_PATH__ ?? '') : ''

export const APP_NAME: string =
	Platform.OS === 'web' && typeof window !== 'undefined'
		? (window.__APP_NAME__ ?? 'MiniNAS')
		: 'MiniNAS'
