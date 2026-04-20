import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchChats, fetchChat, createChat, deleteChat, sendMessage } from "@/lib/api";

export const CHATS_KEY = ["chats"] as const;
export const chatKey = (id: string) => ["chats", id] as const;

export function useChats() {
  return useQuery({ queryKey: CHATS_KEY, queryFn: fetchChats });
}

export function useChat(id: string) {
  return useQuery({ queryKey: chatKey(id), queryFn: () => fetchChat(id) });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string | undefined) => createChat(title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHATS_KEY }),
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteChat(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHATS_KEY }),
  });
}

export function useSendMessage(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (query: string) => sendMessage(chatId, query),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKey(chatId) }),
  });
}
