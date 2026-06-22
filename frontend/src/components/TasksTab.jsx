import { useState, useEffect, useCallback } from 'react';
import ErrorDisplay from './shared/ErrorDisplay';

export default function TasksTab() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }
      const data = await response.json();
      setTasks(data.tasks || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch tasks:', err);
      // Set empty array on error to show placeholder state
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    const load = async () => {
      await fetchTasks();
    };
    load();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchTasks();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'pending') return task.status === 'pending';
    if (filter === 'in_progress') return task.status === 'in_progress';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

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
        <div className="font-mono text-[10px] text-muted">TASK QUEUE</div>
        <div className="flex gap-2">
          {['all', 'pending', 'in_progress', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-white text-base-100'
                  : 'text-text/60 hover:text-text hover:bg-white/5'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all bg-white/5 hover:bg-white/10 disabled:opacity-50 ml-2"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <ErrorDisplay
          message={error}
          onDismiss={() => setError(null)}
          onRetry={fetchTasks}
        />
      )}

      <div className="space-y-3">
        {loading && tasks.length === 0 ? (
          <div className="glass-card p-6">
            <div className="text-center text-muted">Loading tasks...</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="glass-card p-6">
            <div className="text-center">
              <div className="text-muted mb-2">
                {error ? 'Unable to load tasks' : 'No tasks found'}
              </div>
              {error && (
                <div className="text-xs text-muted">
                  Backend endpoint may not be implemented yet
                </div>
              )}
            </div>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div key={task.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{task.name}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    task.status === 'completed'
                      ? 'bg-mint/20 text-mint'
                      : task.status === 'in_progress'
                      ? 'bg-cyan/20 text-cyan'
                      : 'bg-white/10 text-muted'
                  }`}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-muted mb-2">{task.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>Agent: {task.agent || 'N/A'}</span>
                <span>Created: {task.created_at || 'N/A'}</span>
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
