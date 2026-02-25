import { ChevronRight, Home, MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface BreadcrumbSegment {
	label: string
	path: string
}

interface BreadcrumbsProps {
	segments: BreadcrumbSegment[]
	onNavigate: (path: string) => void
}

export default function Breadcrumbs({ segments, onNavigate }: BreadcrumbsProps) {
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setDropdownOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const showCollapsed = segments.length > 2

	return (
		<nav className="flex items-center gap-1 text-sm overflow-x-auto">
			<button
				type="button"
				onClick={() => onNavigate('')}
				className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors shrink-0"
			>
				<Home size={14} />
			</button>

			{showCollapsed ? (
				<>
					{/* First segment (always visible) */}
					<ChevronRight size={14} className="text-gray-300 shrink-0" />
					<button
						type="button"
						onClick={() => onNavigate(segments[0].path)}
						className="px-2 py-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors shrink-0 hidden sm:inline-flex"
					>
						{segments[0].label}
					</button>

					{/* Collapsed middle segments */}
					<div className="relative sm:contents" ref={dropdownRef}>
						<ChevronRight size={14} className="text-gray-300 shrink-0 hidden sm:block" />
						<button
							type="button"
							onClick={() => setDropdownOpen(!dropdownOpen)}
							className="px-1.5 py-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
						>
							<MoreHorizontal size={14} />
						</button>
						{dropdownOpen && (
							<div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px] py-1">
								{/* On mobile, show first segment in dropdown too */}
								<button
									type="button"
									onClick={() => {
										onNavigate(segments[0].path)
										setDropdownOpen(false)
									}}
									className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 text-gray-600 transition-colors sm:hidden"
								>
									{segments[0].label}
								</button>
								{segments.slice(1, -1).map((seg) => (
									<button
										type="button"
										key={seg.path}
										onClick={() => {
											onNavigate(seg.path)
											setDropdownOpen(false)
										}}
										className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 text-gray-600 transition-colors"
									>
										{seg.label}
									</button>
								))}
							</div>
						)}
					</div>

					{/* Last segment (current) */}
					<ChevronRight size={14} className="text-gray-300 shrink-0" />
					<span className="px-2 py-1 text-gray-900 font-medium shrink-0 truncate max-w-[200px]">
						{segments[segments.length - 1].label}
					</span>
				</>
			) : (
				segments.map((crumb) => (
					<div key={crumb.path} className="flex items-center gap-1 shrink-0">
						<ChevronRight size={14} className="text-gray-300" />
						{crumb === segments[segments.length - 1] ? (
							<span className="px-2 py-1 text-gray-900 font-medium truncate max-w-[200px]">
								{crumb.label}
							</span>
						) : (
							<button
								type="button"
								onClick={() => onNavigate(crumb.path)}
								className="px-2 py-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
							>
								{crumb.label}
							</button>
						)}
					</div>
				))
			)}
		</nav>
	)
}
