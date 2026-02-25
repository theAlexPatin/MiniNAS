import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearch } from '../hooks/useSearch'
import { getFileIcon } from '../lib/fileIcons'

interface SearchBarProps {
	volume: string
	onNavigate: (path: string) => void
}

export default function SearchBar({ volume, onNavigate }: SearchBarProps) {
	const [query, setQuery] = useState('')
	const [debouncedQuery, setDebouncedQuery] = useState('')
	const [isOpen, setIsOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 300)
		return () => clearTimeout(timer)
	}, [query])

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setIsOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const { data, isLoading } = useSearch(debouncedQuery, volume)

	return (
		<div ref={ref} className="relative flex-1 max-w-md">
			<div className="relative">
				<Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value)
						setIsOpen(true)
					}}
					onFocus={() => query && setIsOpen(true)}
					placeholder="Search files..."
					className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
				/>
				{query && (
					<button
						type="button"
						onClick={() => {
							setQuery('')
							setIsOpen(false)
						}}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
					>
						<X size={14} />
					</button>
				)}
			</div>

			{/* Dropdown results */}
			{isOpen && debouncedQuery && (
				<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
					{isLoading ? (
						<div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
					) : !data?.results.length ? (
						<div className="px-4 py-3 text-sm text-gray-400">No results</div>
					) : (
						data.results.map((result) => {
							const isDir = result.is_directory === 1
							const dirPath = isDir ? result.path : result.path.split('/').slice(0, -1).join('/')

							return (
								<button
									type="button"
									key={`${result.volume}:${result.path}`}
									onClick={() => {
										onNavigate(dirPath)
										setIsOpen(false)
										setQuery('')
									}}
									className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 text-left transition-colors"
								>
									<span className="shrink-0">
										{getFileIcon(
											{
												name: result.name,
												path: result.path,
												isDirectory: isDir,
												size: 0,
												modifiedAt: '',
												mimeType: null,
											},
											16,
										)}
									</span>
									<div className="min-w-0">
										<p className="text-sm truncate text-gray-900">{result.name}</p>
										<p className="text-xs text-gray-400 truncate">{result.path}</p>
									</div>
								</button>
							)
						})
					)}
				</div>
			)}
		</div>
	)
}
