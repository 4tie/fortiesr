import { useState, useEffect } from 'react';

export default function TasksTab() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Fetch tasks from backend
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => setTasks(data.tasks || []))
      .catch(err => console.error('Failed to fetch tasks:', err));
  }, []);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'pending') return task.status === 'pending';
    if (filter === 'in_progress') return task.status === 'in_progress';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

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
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="glass-card p-6">
            <div className="text-center text-muted">No tasks found</div>
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
                <span>Agent: {task.agent}</span>
                <span>Created: {task.created_at}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
