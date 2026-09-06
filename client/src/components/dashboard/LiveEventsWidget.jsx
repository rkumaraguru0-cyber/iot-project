import React, { useState, useEffect } from 'react';
import { Radio, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSecurityEvents } from '../../api/securityEvents';
import { useSocket } from '../../hooks/useSocket';

export const LiveEventsWidget = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { subscribe, isConnected } = useSocket();

  useEffect(() => {
    let isMounted = true;

    const fetchInitialEvents = async () => {
      try {
        setIsLoading(true);
        const data = await getSecurityEvents({ limit: 10, page: 1 });
        if (isMounted) {
          const initialList = data.events || data.securityEvents || data.data || [];
          setEvents(initialList.slice(0, 10));
        }
      } catch (err) {
        console.error('Failed to load initial live events:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchInitialEvents();

    // Subscribe to real-time Socket.IO domain event: security-event:new
    const unsubscribe = subscribe('security-event:new', (newEvent) => {
      if (!newEvent || !newEvent.eventId) return;

      setEvents((prev) => {
        // Deduplicate using eventId
        const exists = prev.some((e) => e.eventId === newEvent.eventId || (e._id && e._id === newEvent._id));
        if (exists) return prev;

        const formatted = {
          _id: newEvent.eventId,
          eventId: newEvent.eventId,
          severity: newEvent.severity,
          category: newEvent.category,
          explanation: newEvent.explanation,
          deviceId: { name: newEvent.deviceName, deviceId: newEvent.deviceId },
          deviceName: newEvent.deviceName,
          createdAt: new Date().toISOString(),
          isLive: true
        };

        return [formatted, ...prev].slice(0, 10);
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [subscribe]);

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-96">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-12 bg-slate-800 rounded"></div>
          <div className="h-12 bg-slate-800 rounded"></div>
          <div className="h-12 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            Recent Security Events (Live Feed)
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isConnected ? 'LIVE WS' : 'REST ONLY'}
            </span>
            <Link to="/security-events" className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">
              Full Stream
            </Link>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No recent security events recorded.
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {events.map((evt) => {
              const deviceLabel = evt.deviceName || evt.deviceId?.name || evt.deviceId?.deviceId || (typeof evt.deviceId === 'string' ? evt.deviceId : 'Device');
              return (
                <div
                  key={evt.eventId || evt._id}
                  className={`p-2.5 rounded-xl bg-slate-950/60 border transition flex items-center justify-between ${
                    evt.isLive ? 'border-indigo-500/50 bg-indigo-950/20 animate-fadeIn' : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="overflow-hidden pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-200">{evt.eventId}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${getSeverityBadge(evt.severity)}`}>
                        {evt.severity}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">{evt.category}</span>
                      {evt.isLive && (
                        <span className="text-[9px] font-mono bg-indigo-500 text-white px-1 rounded animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 truncate mt-0.5">
                      <span className="text-slate-400 font-medium">{deviceLabel}:</span> {evt.explanation || 'Anomaly pattern observed'}
                    </p>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 shrink-0">
                    {evt.createdAt ? new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Now'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-800/60 mt-3 flex justify-between items-center text-xs">
        <span className="text-slate-500 text-[11px]">Real-time deduplication via eventId</span>
        <Link
          to="/security-events"
          className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 text-[11px]"
        >
          View Events Center <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};

export default LiveEventsWidget;
