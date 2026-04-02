import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDocuments, uploadDocument, deleteDocument } from "@/lib/api";

export const DOCUMENTS_KEY = ["documents"] as const;

export function useDocuments() {
  return useQuery({
    queryKey: DOCUMENTS_KEY,
    queryFn: fetchDocuments,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocument(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
  });
}
