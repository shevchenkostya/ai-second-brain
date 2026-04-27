import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchArtifacts,
  fetchArtifact,
  analyzeDocuments,
  deleteArtifact,
  type AnalyzeRequest,
} from "@/lib/api";

export const ARTIFACTS_KEY = ["artifacts"] as const;
export const artifactKey = (id: string) => ["artifacts", id] as const;

export function useArtifacts() {
  return useQuery({ queryKey: ARTIFACTS_KEY, queryFn: fetchArtifacts });
}

export function useArtifact(id: string) {
  return useQuery({ queryKey: artifactKey(id), queryFn: () => fetchArtifact(id) });
}

export function useAnalyze() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AnalyzeRequest) => analyzeDocuments(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ARTIFACTS_KEY }),
  });
}

export function useDeleteArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteArtifact(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ARTIFACTS_KEY }),
  });
}
