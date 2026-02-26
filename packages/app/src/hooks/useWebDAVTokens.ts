import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useWebDAVTokens() {
	return useQuery({
		queryKey: ['webdav-tokens'],
		queryFn: () => api.listWebDAVTokens(),
	})
}

export function useCreateWebDAVToken() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (label: string) => api.createWebDAVToken(label),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['webdav-tokens'] })
		},
	})
}

export function useRevokeWebDAVToken() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: string) => api.revokeWebDAVToken(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['webdav-tokens'] })
		},
	})
}
