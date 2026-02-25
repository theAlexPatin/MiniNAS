declare global {
	interface Window {
		__APP_NAME__?: string
	}
}

// In dev: Vite replaces __APP_NAME_DEFAULT__ at compile time via `define`.
// In prod: the API static middleware injects window.__APP_NAME__ at serve time.
declare const __APP_NAME_DEFAULT__: string

export const APP_NAME: string =
	typeof window !== 'undefined'
		? (window.__APP_NAME__ ?? __APP_NAME_DEFAULT__)
		: __APP_NAME_DEFAULT__
