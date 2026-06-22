import { useState, useEffect, useCallback } from 'react';
import ErrorDisplay from './shared/ErrorDisplay';

export default function ScheduleTab() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/schedule');
      if (!response.ok) {
        throw new Error(`Failed to fetch schedule: ${response.statusText}`);
      }
      const data = await response.json();
      setSchedule(data.schedule || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch schedule:', err);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    const load = async () => {
      await fetchSchedule();
    };
    load();

    // Auto-refresh every 60 seconds (appropriate for schedule data)
    const interval = setInterval(() => {
      fetchSchedule();
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatLastRefresh = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted">SCHEDULED TASKS</div>
        <button
          onClick={fetchSchedule}
          disabled={loading}
          className="px-3 py-1.5 rounded text-xs font-medium transition-all bg-white/5 hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <ErrorDisplay
          message={error}
          onDismiss={() => setError(null)}
          onRetry={fetchSchedule}
        />
      )}

      <div className="space-y-3">
        {loading && schedule.length === 0 ? (
          <div className="glass-card p-6">
            <div className="text-center text-muted">Loading scheduled tasks...</div>
          </div>
        ) : schedule.length === 0 ? (
          <div className="glass-card p-6">
            <div className="text-center">
              <div className="text-muted mb-2">
                {error ? 'Unable to load scheduled tasks' : 'No scheduled tasks'}
              </div>
              {error && (
                <div className="text-xs text-muted">
                  Backend endpoint may not be implemented yet
                </div>
              )}
            </div>
          </div>
        ) : (
          schedule.map((item) => (
            <div key={item.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{item.name}</h3>
                <span className="font-mono text-xs text-muted">{item.next_run || 'N/A'}</span>
              </div>
              <p className="text-sm text-muted mb-2">{item.description || 'No description'}</p>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>Frequency: {item.frequency || 'N/A'}</span>
                <span>Last run: {item.last_run || 'Never'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {lastRefresh && (
        <div className="text-xs text-muted text-center">
          Last updated: {formatLastRefresh(lastRefresh)}
        </div>
      )}
    </div>
  );
}
