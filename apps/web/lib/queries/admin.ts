import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminUsers,
  patchAdminUser,
  deleteAdminUser,
  forceVerifyUser,
} from "@/lib/api";

export const ADMIN_USERS_KEY = ["admin", "users"] as const;

export function useAdminUsers(offset = 0, limit = 50) {
  return useQuery({
    queryKey: [...ADMIN_USERS_KEY, offset, limit],
    queryFn: () => fetchAdminUsers(offset, limit),
  });
}

export function usePatchAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: string; is_active?: boolean } }) =>
      patchAdminUser(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
  });
}

export function useForceVerifyUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => forceVerifyUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
  });
}
