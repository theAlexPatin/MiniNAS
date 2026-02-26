import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// --- Volumes ---

export function useAdminVolumes() {
  return useQuery({
    queryKey: ['admin', 'volumes'],
    queryFn: () => api.adminListVolumes(),
  })
}

export function useAvailableVolumes(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'volumes', 'available'],
    queryFn: () => api.adminListAvailableVolumes(),
    enabled,
  })
}

export function useAddVolume() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, label, path }: { id: string; label: string; path: string }) =>
      api.adminAddVolume(id, label, path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'volumes'] })
    },
  })
}

export function useRemoveVolume() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.adminRemoveVolume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'volumes'] })
    },
  })
}

export function useSetVolumeVisibility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: 'public' | 'private' }) =>
      api.adminSetVolumeVisibility(id, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'volumes'] })
    },
  })
}

export function useVolumeAccess(volumeId: string) {
  return useQuery({
    queryKey: ['admin', 'volume-access', volumeId],
    queryFn: () => api.adminGetVolumeAccess(volumeId),
    enabled: !!volumeId,
  })
}

export function useGrantVolumeAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ volumeId, userId }: { volumeId: string; userId: string }) =>
      api.adminGrantVolumeAccess(volumeId, userId),
    onSuccess: (_data, { volumeId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'volume-access', volumeId] })
    },
  })
}

export function useRevokeVolumeAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ volumeId, userId }: { volumeId: string; userId: string }) =>
      api.adminRevokeVolumeAccess(volumeId, userId),
    onSuccess: (_data, { volumeId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'volume-access', volumeId] })
    },
  })
}

// --- Users ---

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.adminListUsers(),
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.adminDeleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useResetPasskeys() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.adminResetPasskeys(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

// --- Invites ---

export function useAdminInvites() {
  return useQuery({
    queryKey: ['admin', 'invites'],
    queryFn: () => api.adminListInvites(),
  })
}

export function useCreateInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ username, expiresInHours }: { username: string; expiresInHours?: number }) =>
      api.adminCreateInvite(username, expiresInHours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] })
    },
  })
}

export function useDeleteInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.adminDeleteInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] })
    },
  })
}
