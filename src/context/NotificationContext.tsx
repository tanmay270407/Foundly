import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
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

function isJwtExpiredError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();
  return (
    code === 'PGRST301' ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('token is expired')
  );
}

function isTransientNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = String(typeof error === 'string' ? error : error.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('aborterror') ||
    msg.includes('timeout')
  );
}

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, session, profile, signOut } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const inFlightRef = useRef(false);
  const nextAllowedFetchAtRef = useRef(0);
  const consecutiveNetworkErrorsRef = useRef(0);

  // Ensure the active Supabase JWT is fresh before querying when near expiry
  const ensureFreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession) {
        return false;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      if (currentSession.expires_at && currentSession.expires_at <= nowSec + 30) {
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr || !refreshed.session) {
          if (!isTransientNetworkError(refreshErr)) {
            // Refresh token itself is no longer valid; sign out cleanly
            await signOut();
          }
          return false;
        }
      }

      return true;
    } catch (err) {
      if (!isTransientNetworkError(err)) {
        console.warn('[Notifications] Session check warning:', err);
      }
      return false;
    }
  }, [signOut]);

  // Fetch notifications securely using current auth user and valid Supabase session
  const fetchNotifications = useCallback(
    async (options?: { force?: boolean }) => {
      if (!user || !session || !isSupabaseConfigured()) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      // Skip background polling while offline or tab is hidden (unless explicitly forced)
      if (!options?.force) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        if (Date.now() < nextAllowedFetchAtRef.current) return;
      }

      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const hasValidSession = await ensureFreshSession();
        if (!hasValidSession) {
          return;
        }

        const runQuery = () =>
          supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        let { data, error } = await runQuery();

        // If JWT expired mid-flight (e.g. after laptop sleep), refresh once and retry seamlessly
        if (error && isJwtExpiredError(error)) {
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
          if (!refreshErr && refreshed.session) {
            const retry = await runQuery();
            data = retry.data;
            error = retry.error;
          } else {
            if (!isTransientNetworkError(refreshErr)) {
              await signOut();
            }
            return;
          }
        }

        if (error) {
          if (isTransientNetworkError(error)) {
            consecutiveNetworkErrorsRef.current = Math.min(consecutiveNetworkErrorsRef.current + 1, 4);
            const backoffMs = 15000 * Math.pow(2, consecutiveNetworkErrorsRef.current - 1);
            nextAllowedFetchAtRef.current = Date.now() + backoffMs;
            return;
          }
          if (isJwtExpiredError(error)) {
            await signOut();
            return;
          }
          console.warn('[Notifications] Fetch skipped:', error.message);
          return;
        }

        consecutiveNetworkErrorsRef.current = 0;
        nextAllowedFetchAtRef.current = 0;

        if (data) {
          const items = data as NotificationItem[];
          setNotifications(items);
          setUnreadCount(items.filter((n) => !n.read).length);
        }
      } catch (err) {
        if (isTransientNetworkError(err)) {
          consecutiveNetworkErrorsRef.current = Math.min(consecutiveNetworkErrorsRef.current + 1, 4);
          const backoffMs = 15000 * Math.pow(2, consecutiveNetworkErrorsRef.current - 1);
          nextAllowedFetchAtRef.current = Date.now() + backoffMs;
          return;
        }
        console.warn('[Notifications] Fetch exception:', err);
      } finally {
        inFlightRef.current = false;
      }
    },
    [user, session, ensureFreshSession, signOut]
  );

  // Mark specific notification as read
  const markAsRead = async (id: string) => {
    if (!user || !session || !isSupabaseConfigured()) return;

    // Optimistically update UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const hasValidSession = await ensureFreshSession();
      if (!hasValidSession) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        if (!isTransientNetworkError(error)) {
          console.warn('[Notifications] Mark as read failed:', error.message);
        }
        fetchNotifications({ force: true });
      }
    } catch (err) {
      if (!isTransientNetworkError(err)) {
        console.warn('[Notifications] Mark as read exception:', err);
      }
    }
  };

  // Mark all user's notifications as read
  const markAllAsRead = async () => {
    if (!user || !session || !isSupabaseConfigured() || notifications.length === 0) return;

    // Optimistically update UI
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      const hasValidSession = await ensureFreshSession();
      if (!hasValidSession) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        if (!isTransientNetworkError(error)) {
          console.warn('[Notifications] Mark all as read failed:', error.message);
        }
        fetchNotifications({ force: true });
      }
    } catch (err) {
      if (!isTransientNetworkError(err)) {
        console.warn('[Notifications] Mark all as read exception:', err);
      }
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
    if (!isSupabaseConfigured() || !session) return;

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
    if (!isSupabaseConfigured() || !session) return;

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

  // Handle active fetch, visibility/online resume, and resilient polling
  useEffect(() => {
    if (user && session) {
      consecutiveNetworkErrorsRef.current = 0;
      nextAllowedFetchAtRef.current = 0;

      setIsLoading(true);
      fetchNotifications({ force: true }).finally(() => setIsLoading(false));

      const interval = setInterval(() => {
        fetchNotifications();
      }, 15000);

      const handleResume = () => {
        if (document.visibilityState === 'visible' && navigator.onLine !== false) {
          consecutiveNetworkErrorsRef.current = 0;
          nextAllowedFetchAtRef.current = 0;
          fetchNotifications({ force: true });
        }
      };

      window.addEventListener('online', handleResume);
      document.addEventListener('visibilitychange', handleResume);

      return () => {
        clearInterval(interval);
        window.removeEventListener('online', handleResume);
        document.removeEventListener('visibilitychange', handleResume);
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, session, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications: () => fetchNotifications({ force: true }),
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
