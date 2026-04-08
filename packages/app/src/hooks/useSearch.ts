import { useQuery } from '@tanstack/react-query'
import { getApiBase } from '@/lib/api'

interface SearchResult {
	id: number
	volume: string
	path: string
	name: string
	extension: string | null
	size: number
	mime_type: string | null
	is_directory: number
	modified_at: string
}

async function searchFiles(query: string, volume?: string): Promise<{ results: SearchResult[] }> {
	const params = new URLSearchParams({ q: query })
	if (volume) params.set('volume', volume)

	const res = await fetch(`${getApiBase()}/search?${params}`, { credentials: 'include' })
	if (!res.ok) throw new Error('Search failed')
	return res.json()
}

export function useSearch(query: string, volume?: string) {
	return useQuery({
		queryKey: ['search', query, volume],
		queryFn: () => searchFiles(query, volume),
		enabled: query.length >= 1,
		staleTime: 10_000,
	})
}
