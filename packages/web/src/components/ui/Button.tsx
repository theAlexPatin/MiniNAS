import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'

const variantStyles = {
	primary: 'bg-brand-600 hover:bg-brand-700 text-white',
	secondary: 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm',
	ghost: 'hover:bg-gray-100 text-gray-600',
	danger: 'bg-red-600 hover:bg-red-700 text-white',
} as const

const sizeStyles = {
	sm: 'px-2 py-1 text-xs gap-1',
	md: 'px-3 py-1.5 text-sm gap-1.5',
	lg: 'px-4 py-2 text-sm gap-2',
	icon: 'p-1.5',
} as const

type ButtonVariant = keyof typeof variantStyles
type ButtonSize = keyof typeof sizeStyles

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant
	size?: ButtonSize
	loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props }, ref) => {
		return (
			<button
				ref={ref}
				type="button"
				disabled={disabled || loading}
				className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
				{...props}
			>
				{loading && <Loader2 size={16} className="animate-spin" />}
				{children}
			</button>
		)
	},
)

Button.displayName = 'Button'

export default Button
