'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FiInfo,
  FiCheckCircle,
  FiAlertTriangle,
  FiAlertCircle,
  FiX,
} from 'react-icons/fi';
import { HiShieldCheck } from 'react-icons/hi';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import type { Notification } from '@/store/notificationStore';

interface PopupNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

function getPopupIcon(type: string) {
  switch (type) {
    case 'success':
      return <FiCheckCircle className="w-5 h-5 text-emerald-500" />;
    case 'warning':
      return <FiAlertTriangle className="w-5 h-5 text-amber-500" />;
    case 'error':
      return <FiAlertCircle className="w-5 h-5 text-red-500" />;
    case 'login':
    case 'logout':
      return <HiShieldCheck className="w-5 h-5 text-teal-500" />;
    case 'workflow':
      return <FiInfo className="w-5 h-5 text-orange-500" />;
    default:
      return <FiInfo className="w-5 h-5 text-green-500" />;
  }
}

function getPopupBorderColor(type: string) {
  switch (type) {
    case 'success':
      return 'border-l-emerald-500';
    case 'warning':
      return 'border-l-amber-500';
    case 'error':
      return 'border-l-red-500';
    case 'login':
    case 'logout':
      return 'border-l-teal-500';
    case 'workflow':
      return 'border-l-orange-500';
    default:
      return 'border-l-green-500';
  }
}

function getPopupBgColor(type: string) {
  switch (type) {
    case 'success':
      return 'bg-emerald-50';
    case 'warning':
      return 'bg-amber-50';
    case 'error':
      return 'bg-red-50';
    case 'login':
    case 'logout':
      return 'bg-teal-50';
    case 'workflow':
      return 'bg-orange-50';
    default:
      return 'bg-green-50';
  }
}

function NotificationPopupItem({
  notification,
  onDismiss,
}: {
  notification: PopupNotification;
  onDismiss: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(notification.id), 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(notification.id), 300);
  };

  return (
    <div
      className={`w-80 thb-card shadow-xl border-l-4 ${getPopupBorderColor(notification.type)} ${
        isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'
      }`}
    >
      <div className={`p-3 ${getPopupBgColor(notification.type)} rounded-r-[11px]`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getPopupIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-thb-text-primary truncate">
              {notification.title}
            </p>
            <p className="text-xs text-thb-text-secondary mt-0.5 line-clamp-2">
              {notification.message}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-md text-thb-text-muted hover:text-thb-text-primary hover:bg-white/60 transition-colors"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationPopup() {
  const [popups, setPopups] = useState<PopupNotification[]>([]);
  const lastCheckedIds = useRef<Set<string>>(new Set());
  const { notifications } = useNotificationStore();
  const { isAuthenticated: isAuthed } = useAuthStore();
  const prevAuthState = useRef(isAuthed);
  // Track whether we've already shown a login notification for this session
  const hasShownLoginNotif = useRef(false);

  const handleDismiss = useCallback((id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Track new notifications to display popups — but only show ONE per session
  useEffect(() => {
    // Reset on auth change (logout → login)
    if (prevAuthState.current !== isAuthed) {
      lastCheckedIds.current = new Set();
      setPopups([]);
      hasShownLoginNotif.current = false;
      prevAuthState.current = isAuthed;

      // On fresh login, mark ALL previous notifications as read to avoid a flood
      if (isAuthed) {
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markAll: true }),
        }).catch(() => {
          // Silently fail — this is just cleanup
        });
      }
      return;
    }

    if (!isAuthed) return;

    // Find new unread notifications that we haven't shown yet
    const newNotifs = notifications.filter(
      (n: Notification) => !n.isRead && !lastCheckedIds.current.has(n.id)
    );

    if (newNotifs.length > 0) {
      // Add all to the "seen" set so we don't re-process them
      newNotifs.forEach((n: Notification) => lastCheckedIds.current.add(n.id));

      // Only show ONE notification popup per login session — pick the most recent one
      if (!hasShownLoginNotif.current && newNotifs.length > 0) {
        hasShownLoginNotif.current = true;
        const latest = newNotifs[newNotifs.length - 1];
        const popup: PopupNotification = {
          id: latest.id,
          title: latest.title,
          message: latest.message,
          type: latest.type,
          createdAt: latest.createdAt,
        };
        queueMicrotask(() => {
          setPopups([popup]);
        });

        // Mark all other notifications as read in the background
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markAll: true }),
        }).catch(() => {
          // Silently fail
        });
      }
    }
  }, [notifications, isAuthed]);

  if (popups.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {popups.map((popup) => (
        <div key={popup.id} className="pointer-events-auto">
          <NotificationPopupItem
            notification={popup}
            onDismiss={handleDismiss}
          />
        </div>
      ))}
    </div>
  );
}
