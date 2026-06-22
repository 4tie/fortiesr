import { useState, useEffect } from 'react';

export default function ScheduleTab() {
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    // Fetch schedule from backend
    fetch('/api/schedule')
      .then(res => res.json())
      .then(data => setSchedule(data.schedule || []))
      .catch(err => console.error('Failed to fetch schedule:', err));
  }, []);

  return (
    <div className="space-y-6">
      <div className="font-mono text-[10px] text-muted mb-4">SCHEDULED TASKS</div>
      
      <div className="space-y-3">
        {schedule.length === 0 ? (
          <div className="glass-card p-6">
            <div className="text-center text-muted">No scheduled tasks</div>
          </div>
        ) : (
          schedule.map((item) => (
            <div key={item.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{item.name}</h3>
                <span className="font-mono text-xs text-muted">{item.next_run}</span>
              </div>
              <p className="text-sm text-muted mb-2">{item.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>Frequency: {item.frequency}</span>
                <span>Last run: {item.last_run || 'Never'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
