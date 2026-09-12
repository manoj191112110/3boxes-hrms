'use client';

import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) return;

      set({ isLoading: true });
      const res = await fetch('/api/notifications?limit=20', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        set({ isLoading: false });
        return;
      }

      const data = await res.json();
      const notifications: Notification[] = data.notifications || [];
      const unreadCount = notifications.filter((n) => !n.isRead).length;

      set({
        notifications,
        unreadCount,
        isLoading: false,
      });
    } catch (error) {
      console.error('Fetch notifications error:', error);
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) return;

      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        const { notifications } = get();
        const updated = notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        const unreadCount = updated.filter((n) => !n.isRead).length;
        set({ notifications: updated, unreadCount });
      }
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) return;

      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ markAll: true }),
      });

      if (res.ok) {
        const { notifications } = get();
        const updated = notifications.map((n) => ({ ...n, isRead: true }));
        set({ notifications: updated, unreadCount: 0 });
      }
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  },
}));
