import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Package, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { APP_NAME } from '../lib/appName'
import Button from './ui/Button'

export default function UpdateSection() {
	const [restarting, setRestarting] = useState(false)
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const { data, isLoading } = useQuery({
		queryKey: ['version'],
		queryFn: () => api.getVersion(),
	})

	// Poll the version endpoint after triggering an update to detect when the server is back
	useEffect(() => {
		if (!restarting) return

		// Wait a few seconds before polling to give the server time to go down
		const startDelay = setTimeout(() => {
			pollRef.current = setInterval(async () => {
				try {
					await api.getVersion()
					// Server is back — reload so the UI picks up any changes
					window.location.reload()
				} catch {
					// Server still down, keep polling
				}
			}, 2000)
		}, 3000)

		return () => {
			clearTimeout(startDelay)
			if (pollRef.current) clearInterval(pollRef.current)
		}
	}, [restarting])

	const updateMutation = useMutation({
		mutationFn: () => api.triggerUpdate(),
		onSuccess: () => {
			setRestarting(true)
		},
	})

	return (
		<div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
			<div className="flex items-center gap-2.5 mb-3">
				<Package size={18} className="text-gray-700" />
				<h2 className="text-sm font-semibold text-gray-900">Software Update</h2>
			</div>

			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm text-gray-600">
						Current version:{' '}
						{isLoading ? (
							<span className="text-gray-400">loading...</span>
						) : (
							<span className="font-mono font-medium text-gray-800">
								{data?.version || 'unknown'}
							</span>
						)}
					</p>
				</div>

				{restarting ? (
					<div className="flex items-center gap-2 text-sm text-amber-600">
						<Loader2 size={16} className="animate-spin" />
						Restarting...
					</div>
				) : (
					<Button
						onClick={() => {
							if (confirm(`Update ${APP_NAME} and restart the server?`)) {
								updateMutation.mutate()
							}
						}}
						loading={updateMutation.isPending}
					>
						<RefreshCw size={16} />
						Update & Restart
					</Button>
				)}
			</div>

			{updateMutation.isError && (
				<p className="mt-2 text-sm text-red-600">
					Failed to trigger update. Is {APP_NAME} installed via Homebrew?
				</p>
			)}
		</div>
	)
}
