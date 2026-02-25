declare global {
	interface Window {
		__APP_NAME__?: string
	}
}

export const APP_NAME: string = typeof window !== 'undefined' ? (window.__APP_NAME__ ?? 'MiniNAS') : 'MiniNAS'
