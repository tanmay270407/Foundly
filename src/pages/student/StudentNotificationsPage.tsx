import React from 'react';
import { Bell, CheckCheck, Clock, ArrowRight } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { NotificationItem } from '../../types';
import { useRouter } from '../../context/RouterContext';
import { useNotifications } from '../../context/NotificationContext';

export const StudentNotificationsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { notifications, markAsRead, markAllAsRead, isLoading } = useNotifications();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
          <p className="text-xs text-slate-500 mt-1">
            Updates on your lost/found submissions, match suggestions, and claim approvals
          </p>
        </div>

        {notifications.some(n => !n.read) && (
          <Button 
            size="sm" 
            variant="ghost" 
            leftIcon={<CheckCheck className="w-4 h-4" />}
            onClick={markAllAsRead}
          >
            Mark all as read
          </Button>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        {isLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            <span className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin inline-block mr-2" />
            Loading updates...
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description="You are completely caught up. When an admin reviews your report, a potential item match is discovered, or a claim update occurs, you will receive an alert here."
            icon={<Bell className="w-8 h-8 text-slate-400" />}
            actionLabel="Return to Dashboard"
            onAction={() => navigate('/student')}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => {
              const [mainType, relatedId] = notif.type.includes(':') 
                ? notif.type.split(':') 
                : [notif.type, ''];

              const handleItemClick = async () => {
                await markAsRead(notif.id);
                if (mainType === 'AI_MATCH_SUGGESTED' || mainType === 'POSSIBLE_MATCH') {
                  navigate('/student/activity');
                } else if (relatedId) {
                  navigate(`/student/item/${relatedId}`);
                } else {
                  navigate('/student/activity');
                }
              };

              return (
                <div
                  key={notif.id}
                  onClick={handleItemClick}
                  className={`py-4 px-4 flex items-start justify-between gap-4 hover:bg-slate-50/60 transition cursor-pointer rounded-2xl border border-transparent ${
                    !notif.read ? 'bg-indigo-50/10 border-indigo-100/40' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm text-slate-900 ${!notif.read ? 'font-bold' : 'font-semibold'}`}>{notif.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(notif.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {!notif.read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 mt-2 shrink-0"></span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Overview of Notification Types Prepared */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 space-y-1.5">
        <p className="font-semibold text-slate-700">Supported System Events:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
          <span>• Report submitted</span>
          <span>• Report approved / published</span>
          <span>• AI match alert</span>
          <span>• Claim submitted</span>
          <span>• Admin verification approved</span>
          <span>• Handover scheduled</span>
          <span>• Handover confirmed (Case closed)</span>
        </div>
      </div>
    </div>
  );
};
