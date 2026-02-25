import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
	icon: LucideIcon
	title: string
	description?: string
	action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<Icon size={48} className="mb-3 text-gray-300" />
			<p className="text-gray-500 font-medium">{title}</p>
			{description && <p className="text-sm text-gray-400 mt-1 max-w-xs">{description}</p>}
			{action && <div className="mt-4">{action}</div>}
		</div>
	)
}
