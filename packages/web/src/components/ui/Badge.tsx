const variantStyles = {
	default: 'bg-gray-100 text-gray-600',
	primary: 'bg-brand-50 text-brand-700',
	success: 'bg-emerald-100 text-emerald-700',
	warning: 'bg-amber-100 text-amber-700',
	error: 'bg-red-100 text-red-700',
	info: 'bg-blue-100 text-blue-700',
} as const

type BadgeVariant = keyof typeof variantStyles

interface BadgeProps {
	variant?: BadgeVariant
	children: React.ReactNode
	className?: string
}

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
	return (
		<span
			className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded font-medium ${variantStyles[variant]} ${className}`}
		>
			{children}
		</span>
	)
}
