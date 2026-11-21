import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Button } from '../../components/ui/Button';
import { useRouter } from '../../context/RouterContext';
import { useNotifications } from '../../context/NotificationContext';

export const StudentNotificationsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { notifications, markAsRead, markAllAsRead, isLoading } = useNotifications();

  return (
    <div className="w-full max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
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

      {isLoading ? (
        <LoadingState message="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          icon={<Bell className="w-5 h-5 text-slate-400" />}
          actionLabel="Go Home"
          onAction={() => navigate('/student')}
        />
      ) : (
        <div className="rounded-xl border border-slate-200/80 bg-white divide-y divide-slate-100 overflow-hidden">
          {notifications.map((notif) => {
            const rawType = notif.type || '';
            const [mainType, relatedId] = rawType.includes(':')
              ? rawType.split(':')
              : [rawType, ''];

            const handleItemClick = async () => {
              await markAsRead(notif.id);
              if (mainType === 'AI_MATCH_SUGGESTED' || mainType === 'POSSIBLE_MATCH') {
                navigate('/student');
              } else if (mainType.startsWith('CLAIM')) {
                navigate('/student/claims');
              } else if (relatedId) {
                navigate(`/student/item/${relatedId}`);
              } else {
                navigate('/student/reports');
              }
            };

            return (
              <button
                key={notif.id}
                type="button"
                onClick={handleItemClick}
                className={`w-full px-5 py-3.5 text-left flex items-start justify-between gap-4 hover:bg-slate-50/80 transition-colors ${
                  !notif.read ? 'bg-indigo-50/25' : ''
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                      !notif.read ? 'bg-indigo-600' : 'bg-transparent'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className={`text-sm text-slate-900 ${!notif.read ? 'font-semibold' : 'font-medium'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0 mt-0.5">
                  {new Date(notif.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
