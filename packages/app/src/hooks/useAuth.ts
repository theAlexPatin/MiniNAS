import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { checkSession, logout as logoutFn } from '@/lib/passkeys'

export function useAuth() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: checkSession,
    staleTime: 60_000,
    retry: false,
  })

  const handleLogout = async () => {
    await logoutFn()
    queryClient.setQueryData(['auth', 'session'], {
      authenticated: false,
      user: null,
    })
    router.replace('/login')
  }

  return {
    isAuthenticated: data?.authenticated ?? false,
    user: data?.user ?? null,
    isLoading,
    logout: handleLogout,
  }
}
