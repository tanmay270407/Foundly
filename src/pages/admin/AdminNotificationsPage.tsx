import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Button } from '../../components/ui/Button';
import { useNotifications } from '../../context/NotificationContext';
import { useRouter } from '../../context/RouterContext';

export const AdminNotificationsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { notifications, markAsRead, markAllAsRead, isLoading } = useNotifications();

  return (
    <div className="w-full max-w-3xl space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notifications</h1>

        {notifications.some((n) => !n.read) && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
            onClick={markAllAsRead}
          >
            Mark all read
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading notifications..." />
        ) : notifications.length === 0 ? (
          <EmptyState
            className="border-0 rounded-none"
            title="All caught up"
            icon={<Bell className="w-5 h-5 text-slate-400" />}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => {
              const [mainType] = notif.type.includes(':')
                ? notif.type.split(':')
                : [notif.type];

              const handleItemClick = async () => {
                await markAsRead(notif.id);
                if (mainType.includes('MATCH')) {
                  navigate('/admin/matches');
                } else if (mainType.includes('CLAIM')) {
                  navigate('/admin/claims');
                } else {
                  navigate('/admin/items');
                }
              };

              return (
                <button
                  key={notif.id}
                  type="button"
                  onClick={handleItemClick}
                  className={`w-full text-left px-4 py-3.5 flex items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors ${
                    !notif.read ? 'bg-indigo-50/25' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                      )}
                      <p className={`text-sm text-slate-900 truncate ${!notif.read ? 'font-semibold' : 'font-medium'}`}>
                        {notif.title}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{notif.message}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0 mt-0.5">
                    {new Date(notif.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
