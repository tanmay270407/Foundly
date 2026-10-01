import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { NotificationItem } from '../types';

interface NotificationContextProps {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  createSystemNotification: (params: {
    userId: string;
    collegeId?: string;
    title: string;
    message: string;
    type: string;
  }) => Promise<void>;
  logSystemActivity: (params: {
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
    collegeId?: string;
  }) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch notifications securely using current auth user
  const fetchNotifications = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Notifications Fetch Error]', error.message);
        return;
      }

      if (data) {
        const items = data as NotificationItem[];
        setNotifications(items);
        setUnreadCount(items.filter((n) => !n.read).length);
      }
    } catch (err) {
      console.error('[Notifications Callback Exception]', err);
    }
  }, [user]);

  // Mark specific notification as read
  const markAsRead = async (id: string) => {
    if (!user || !isSupabaseConfigured()) return;

    // Optimistically update UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('[Mark As Read Error]', error.message);
        // Revert on error
        fetchNotifications();
      }
    } catch (err) {
      console.error('[Mark As Read Exception]', err);
    }
  };

  // Mark all user's notifications as read
  const markAllAsRead = async () => {
    if (!user || !isSupabaseConfigured() || notifications.length === 0) return;

    // Optimistically update UI
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('[Mark All As Read Error]', error.message);
        fetchNotifications();
      }
    } catch (err) {
      console.error('[Mark All As Read Exception]', err);
    }
  };

  // Fail-safely create in-app notification
  const createSystemNotification = async (params: {
    userId: string;
    collegeId?: string;
    title: string;
    message: string;
    type: string;
  }) => {
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: params.userId,
        college_id: params.collegeId || profile?.college_id || null,
        title: params.title,
        message: params.message,
        type: params.type,
        read: false,
      });

      if (error) {
        console.warn('[Fail-Safe Notification Creation Failed]', error.message);
      }
    } catch (err) {
      console.warn('[Fail-Safe Notification Exception]', err);
    }
  };

  // Fail-safely log activity
  const logSystemActivity = async (params: {
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
    collegeId?: string;
  }) => {
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase.from('activity_logs').insert({
        actor_id: user?.id || null,
        college_id: params.collegeId || profile?.college_id || null,
        action: params.action,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        metadata: params.metadata || {},
      });

      if (error) {
        console.warn('[Fail-Safe Activity Logging Failed]', error.message);
      }
    } catch (err) {
      console.warn('[Fail-Safe Activity Log Exception]', err);
    }
  };

  // Handle active fetch and setup standard polling for real-time responsiveness
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      fetchNotifications().finally(() => setIsLoading(false));

      // Reliable 8-second polling
      const interval = setInterval(() => {
        fetchNotifications();
      }, 8000);

      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        createSystemNotification,
        logSystemActivity,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
