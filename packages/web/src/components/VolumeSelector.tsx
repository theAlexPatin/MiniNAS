import { useQuery } from '@tanstack/react-query'
import { HardDrive } from 'lucide-react'
import { useEffect } from 'react'
import { api, type VolumeInfo } from '../lib/api'

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

interface VolumeSelectorProps {
	selectedVolume: string
	onSelect: (volumeId: string) => void
}

export default function VolumeSelector({ selectedVolume, onSelect }: VolumeSelectorProps) {
	const { data, isLoading } = useQuery({
		queryKey: ['volumes'],
		queryFn: () => api.getVolumes(),
	})

	const volumes = data?.volumes || []

	// Auto-select first volume when none is selected
	useEffect(() => {
		if (volumes.length > 0 && !selectedVolume) {
			onSelect(volumes[0].id)
		}
	}, [volumes, selectedVolume, onSelect])

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
				<HardDrive size={16} />
				Loading volumes...
			</div>
		)
	}

	if (volumes.length === 0) {
		return (
			<div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
				<HardDrive size={16} />
				No volumes configured
			</div>
		)
	}

	return (
		<div className="flex items-center gap-2">
			<HardDrive size={16} className="text-gray-400 shrink-0" />
			<select
				value={selectedVolume}
				onChange={(e) => onSelect(e.target.value)}
				className="bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm min-w-0 max-w-[200px] sm:max-w-none truncate"
			>
				{volumes.map((v: VolumeInfo) => (
					<option key={v.id} value={v.id}>
						{v.label} — {formatBytes(v.usedBytes)} / {formatBytes(v.totalBytes)}
					</option>
				))}
			</select>
		</div>
	)
}
