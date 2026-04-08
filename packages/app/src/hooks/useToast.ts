import { useCallback, useState } from 'react'

export interface Toast {
	id: string
	type: 'success' | 'error' | 'info'
	message: string
}

let nextId = 0

export function useToast() {
	const [toasts, setToasts] = useState<Toast[]>([])

	const addToast = useCallback((type: Toast['type'], message: string, duration = 4000) => {
		const id = String(++nextId)
		setToasts((prev) => [...prev, { id, type, message }])
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id))
		}, duration)
	}, [])

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}, [])

	return { toasts, addToast, removeToast }
}
