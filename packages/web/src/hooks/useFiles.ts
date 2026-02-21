import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useFiles(volume: string, path: string) {
  return useQuery({
    queryKey: ["files", volume, path],
    queryFn: () => api.listFiles(volume, path),
    enabled: !!volume,
  });
}

export function useDeleteFile(volume: string, currentPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filePath: string) => api.deleteFile(volume, filePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", volume, currentPath] });
    },
  });
}

export function useMoveFile(volume: string, currentPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, destination }: { path: string; destination: string }) =>
      api.moveFile(volume, path, destination),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", volume, currentPath] });
    },
  });
}

export function useCreateDirectory(volume: string, currentPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createDirectory(volume, currentPath, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", volume, currentPath] });
    },
  });
}
