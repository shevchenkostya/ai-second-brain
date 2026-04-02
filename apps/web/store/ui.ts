import { create } from "zustand";

interface Notification {
  id: string;
  type: "success" | "error";
  message: string;
}

interface UIState {
  uploading: boolean;
  notifications: Notification[];
  setUploading: (value: boolean) => void;
  addNotification: (type: Notification["type"], message: string) => void;
  removeNotification: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  uploading: false,
  notifications: [],

  setUploading: (value) => set({ uploading: value }),

  addNotification: (type, message) => {
    const id = crypto.randomUUID();
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }],
    }));
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 4000);
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
