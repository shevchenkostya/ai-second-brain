import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchGoogleDriveStatus,
  fetchGoogleAuthUrl,
  fetchGoogleDriveSources,
  ingestGoogleDriveFile,
} from "@/lib/api";
import { DOCUMENTS_KEY } from "./documents";

export const GOOGLE_STATUS_KEY = ["mcp", "google", "status"] as const;
export const GOOGLE_SOURCES_KEY = ["mcp", "google", "sources"] as const;

export function useGoogleDriveStatus() {
  return useQuery({
    queryKey: GOOGLE_STATUS_KEY,
    queryFn: fetchGoogleDriveStatus,
  });
}

export function useGoogleDriveSources(enabled: boolean) {
  return useQuery({
    queryKey: GOOGLE_SOURCES_KEY,
    queryFn: fetchGoogleDriveSources,
    enabled,
  });
}

export function useConnectGoogleDrive() {
  return useMutation({
    mutationFn: async () => {
      const { auth_url } = await fetchGoogleAuthUrl();
      window.location.href = auth_url;
    },
  });
}

export function useIngestGoogleDriveFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file_id: string) => ingestGoogleDriveFile(file_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
  });
}
