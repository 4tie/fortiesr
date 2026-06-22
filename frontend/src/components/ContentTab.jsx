import { useState, useEffect } from 'react';

export default function ContentTab() {
  const [content, setContent] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Fetch content from backend
    fetch('/api/content')
      .then(res => res.json())
      .then(data => setContent(data.content || []))
      .catch(err => console.error('Failed to fetch content:', err));
  }, []);

  const filteredContent = content.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'strategies') return item.type === 'strategy';
    if (filter === 'reports') return item.type === 'report';
    if (filter === 'logs') return item.type === 'log';
    return true;
  });

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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContent.length === 0 ? (
          <div className="glass-card p-6 col-span-full">
            <div className="text-center text-muted">No content found</div>
          </div>
        ) : (
          filteredContent.map((item) => (
            <div key={item.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    item.type === 'strategy'
                      ? 'bg-violet/20 text-violet'
                      : item.type === 'report'
                      ? 'bg-cyan/20 text-cyan'
                      : 'bg-white/10 text-muted'
                  }`}
                >
                  {item.type}
                </span>
                <span className="font-mono text-xs text-muted">{item.size}</span>
              </div>
              <h3 className="font-medium mb-1">{item.name}</h3>
              <p className="text-sm text-muted mb-2">{item.description}</p>
              <div className="text-xs text-muted">Created: {item.created_at}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
