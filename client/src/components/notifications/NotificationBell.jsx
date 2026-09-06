import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  ShieldAlert,
  AlertTriangle,
  Radio,
  Flame,
  X
} from 'lucide-react';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead
} from '../../api/notifications';
import { useSocket } from '../../hooks/useSocket';
import toast from 'react-hot-toast';

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const dropdownRef = useRef(null);
  const { subscribe } = useSocket();

  // Load unread count on mount
  useEffect(() => {
    let isMounted = true;

    const fetchCount = async () => {
      try {
        const res = await getUnreadCount();
        if (isMounted) {
          setUnreadCount(res.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to load unread notifications count:', err);
      }
    };

    fetchCount();

    // Subscribe to real-time notification:new domain event
    const unsubscribe = subscribe('notification:new', (newNotif) => {
      setUnreadCount((count) => count + 1);
      setNotifications((prev) => [
        {
          _id: newNotif.notificationId,
          type: newNotif.type,
          title: newNotif.title,
          severity: newNotif.severity,
          read: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ].slice(0, 15));

      toast(
        (t) => (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
            <div>
              <p className="text-xs font-bold text-white">{newNotif.title}</p>
              <p className="text-[11px] text-slate-300">New {newNotif.severity} alert received</p>
            </div>
          </div>
        ),
        {
          duration: 4000,
          style: {
            background: '#0f172a',
            border: '1px solid #312e81',
            color: '#f8fafc'
          }
        }
      );
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [subscribe]);

  // Load notification list when dropdown opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchList = async () => {
      try {
        setIsLoading(true);
        const res = await getNotifications({ limit: 15 });
        if (isMounted) {
          setNotifications(res.notifications || []);
          setUnreadCount(res.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to fetch notifications list:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchList();

    // Close on click outside
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      isMounted = false;
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'security_event':
        return <Flame className="w-4 h-4 text-red-400" />;
      case 'incident_created':
      case 'incident_updated':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'risk_escalated':
        return <ShieldAlert className="w-4 h-4 text-orange-400" />;
      case 'device_quarantined':
        return <Radio className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white shadow-lg shadow-indigo-600/50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px] animate-fadeIn">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 px-1.5 py-0.2 rounded border border-indigo-500/30">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="overflow-y-auto divide-y divide-slate-800/50 flex-1">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No notifications found.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`p-3 transition flex items-start justify-between gap-3 ${
                    notif.read
                      ? 'bg-slate-900/40 hover:bg-slate-800/40 text-slate-400'
                      : 'bg-indigo-950/20 hover:bg-indigo-950/30 text-slate-200'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-bold truncate ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="text-[9px] font-mono text-slate-500 mt-1">
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                    </p>
                  </div>

                  {!notif.read && (
                    <button
                      onClick={(e) => handleMarkRead(notif._id, e)}
                      className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition shrink-0"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
