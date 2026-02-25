import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'
import type { Toast as ToastType } from '../../hooks/useToast'

const iconMap = {
	success: CheckCircle,
	error: AlertCircle,
	info: Info,
} as const

const styleMap = {
	success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
	error: 'border-red-200 bg-red-50 text-red-800',
	info: 'border-blue-200 bg-blue-50 text-blue-800',
} as const

interface ToastContainerProps {
	toasts: ToastType[]
	onDismiss: (id: string) => void
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
	if (toasts.length === 0) return null

	return (
		<div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
			{toasts.map((toast) => {
				const Icon = iconMap[toast.type]
				return (
					<div
						key={toast.id}
						className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-md animate-in slide-in-from-right ${styleMap[toast.type]}`}
					>
						<Icon size={18} className="shrink-0 mt-0.5" />
						<p className="text-sm flex-1">{toast.message}</p>
						<button
							type="button"
							onClick={() => onDismiss(toast.id)}
							className="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
						>
							<X size={14} />
						</button>
					</div>
				)
			})}
		</div>
	)
}
