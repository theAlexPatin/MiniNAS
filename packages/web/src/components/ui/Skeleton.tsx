function Skeleton({ className = '' }: { className?: string }) {
	return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

export function FileListSkeleton({ rows = 8 }: { rows?: number }) {
	return (
		<div className="space-y-0">
			{/* Header */}
			<div className="flex items-center gap-4 pb-3 border-b border-gray-200">
				<Skeleton className="h-4 w-12 ml-3" />
				<Skeleton className="h-4 w-16 ml-auto hidden sm:block" />
				<Skeleton className="h-4 w-24 hidden sm:block" />
				<Skeleton className="h-4 w-10" />
			</div>
			{/* Rows */}
			{Array.from({ length: rows }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
				<div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100">
					<Skeleton className="w-5 h-5 rounded ml-3" />
					<Skeleton className="h-4 flex-1 max-w-[200px]" />
					<Skeleton className="h-4 w-16 ml-auto hidden sm:block" />
					<Skeleton className="h-4 w-28 hidden sm:block" />
					<Skeleton className="h-4 w-10" />
				</div>
			))}
		</div>
	)
}

export function FileGridSkeleton({ items = 10 }: { items?: number }) {
	return (
		<div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
			{Array.from({ length: items }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder items
				<div key={i} className="flex flex-col items-center gap-2 p-2 sm:p-3">
					<Skeleton className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg" />
					<Skeleton className="h-3 w-16 sm:w-20" />
					<Skeleton className="h-2.5 w-10 sm:w-12" />
				</div>
			))}
		</div>
	)
}

export default Skeleton
