import { useState, useEffect, useCallback } from 'react';
import ErrorDisplay from './shared/ErrorDisplay';

export default function ContentTab() {
  const [content, setContent] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/content');
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }
      const data = await response.json();
      setContent(data.content || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch content:', err);
      setContent([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    const load = async () => {
      await fetchContent();
    };
    load();

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchContent();
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredContent = content.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'strategies') return item.type === 'strategy';
    if (filter === 'reports') return item.type === 'report';
    if (filter === 'logs') return item.type === 'log';
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

  const getTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'strategy':
        return 'bg-violet/20 text-violet';
      case 'report':
        return 'bg-cyan/20 text-cyan';
      case 'log':
        return 'bg-pink/20 text-pink';
      default:
        return 'bg-white/10 text-muted';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted">CONTENT LIBRARY</div>
        <div className="flex gap-2">
          {['all', 'strategies', 'reports', 'logs'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-white text-base-100'
                  : 'text-text/60 hover:text-text hover:bg-white/5'
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={fetchContent}
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
          onRetry={fetchContent}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && content.length === 0 ? (
          <div className="glass-card p-6 col-span-full">
            <div className="text-center text-muted">Loading content library...</div>
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="glass-card p-6 col-span-full">
            <div className="text-center">
              <div className="text-muted mb-2">
                {error ? 'Unable to load content' : 'No content found'}
              </div>
              {error && (
                <div className="text-xs text-muted">
                  Backend endpoint may not be implemented yet
                </div>
              )}
            </div>
          </div>
        ) : (
          filteredContent.map((item) => (
            <div key={item.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(item.type)}`}
                >
                  {item.type || 'Unknown'}
                </span>
                <span className="font-mono text-xs text-muted">{item.size || 'N/A'}</span>
              </div>
              <h3 className="font-medium mb-1">{item.name || 'Untitled'}</h3>
              <p className="text-sm text-muted mb-2">{item.description || 'No description'}</p>
              <div className="text-xs text-muted">Created: {item.created_at || 'N/A'}</div>
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
