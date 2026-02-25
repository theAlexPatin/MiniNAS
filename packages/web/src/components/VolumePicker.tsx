import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { HardDrive, Loader2, LogOut, Settings, Shield } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { api, type VolumeInfo } from '../lib/api'
import { APP_NAME } from '../lib/appName'
import { withBase } from '../lib/basePath'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 30_000, retry: 1 },
	},
})

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function VolumeTile({ volume }: { volume: VolumeInfo }) {
	const usagePercent = volume.totalBytes > 0 ? (volume.usedBytes / volume.totalBytes) * 100 : 0
	const barColor =
		usagePercent > 90 ? 'bg-red-500' : usagePercent > 75 ? 'bg-amber-500' : 'bg-brand-500'

	return (
		<a
			href={withBase(`/volumes/${encodeURIComponent(volume.id)}`)}
			className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-brand-300 transition-all"
		>
			<div className="flex items-center gap-3">
				<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 transition-colors">
					<HardDrive size={20} />
				</div>
				<h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
					{volume.label}
				</h2>
			</div>
			<div>
				<div className="h-2 rounded-full bg-gray-100 overflow-hidden">
					<div
						className={`h-full rounded-full ${barColor} transition-all`}
						style={{ width: `${usagePercent}%` }}
					/>
				</div>
				<p className="text-sm text-gray-500 mt-1.5">
					{formatBytes(volume.usedBytes)} used of {formatBytes(volume.totalBytes)}
				</p>
			</div>
		</a>
	)
}

function VolumePickerInner() {
	const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth()

	const { data, isLoading } = useQuery({
		queryKey: ['volumes'],
		queryFn: () => api.getVolumes(),
		enabled: isAuthenticated,
	})

	if (authLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 size={32} className="animate-spin text-gray-400" />
			</div>
		)
	}

	if (!isAuthenticated) {
		if (typeof window !== 'undefined') window.location.href = withBase('/login')
		return null
	}

	const volumes = data?.volumes || []

	// Single volume — redirect straight into it
	if (!isLoading && volumes.length === 1) {
		if (typeof window !== 'undefined') {
			window.location.replace(withBase(`/volumes/${encodeURIComponent(volumes[0].id)}`))
		}
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 size={32} className="animate-spin text-gray-400" />
			</div>
		)
	}

	return (
		<div className="max-w-6xl mx-auto px-4 py-6">
			{/* Header */}
			<div className="flex items-center justify-between gap-3 mb-10">
				<div className="flex items-center gap-2.5 shrink-0">
					<img src="/logo.png" alt={APP_NAME} className="w-8 h-8" />
					<h1 className="text-xl font-semibold text-gray-900 hidden sm:block">{APP_NAME}</h1>
				</div>
				<div className="flex items-center gap-2 sm:gap-4 min-w-0">
					{user?.role === 'admin' && (
						<a
							href={withBase('/admin')}
							className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
							title="Admin"
						>
							<Shield size={18} />
						</a>
					)}
					<a
						href={withBase('/settings')}
						className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
						title="Settings"
					>
						<Settings size={18} />
					</a>
					<button
						type="button"
						onClick={logout}
						className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
						title="Sign out"
					>
						<LogOut size={18} />
					</button>
				</div>
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{Array.from({ length: 3 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder tiles
						<div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
							<div className="flex items-center gap-3 mb-3">
								<div className="w-10 h-10 rounded-lg bg-gray-200" />
								<div className="h-5 w-32 bg-gray-200 rounded" />
							</div>
							<div className="h-2 rounded-full bg-gray-200 mb-1.5" />
							<div className="h-4 w-40 bg-gray-200 rounded" />
						</div>
					))}
				</div>
			) : volumes.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-20 text-center">
					<HardDrive size={48} className="mb-3 text-gray-300" />
					<p className="text-gray-500 font-medium">No volumes available</p>
					{user?.role === 'admin' && (
						<p className="text-sm text-gray-400 mt-1">
							Add volumes in the{' '}
							<a href={withBase('/admin')} className="text-brand-600 hover:underline">
								admin panel
							</a>
						</p>
					)}
				</div>
			) : (
				<>
					<h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
						Volumes
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{volumes.map((v) => (
							<VolumeTile key={v.id} volume={v} />
						))}
					</div>
				</>
			)}
		</div>
	)
}

export default function VolumePicker() {
	return (
		<QueryClientProvider client={queryClient}>
			<VolumePickerInner />
		</QueryClientProvider>
	)
}
