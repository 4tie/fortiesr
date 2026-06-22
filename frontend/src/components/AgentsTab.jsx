import { useState, useEffect } from 'react';

export default function AgentsTab() {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    // Fetch agent data from backend
    fetch('/api/agent/status')
      .then(res => res.json())
      .then(data => setAgents(data.agents || []))
      .catch(err => console.error('Failed to fetch agents:', err));
  }, []);

  return (
    <div className="space-y-6">
      <div className="font-mono text-[10px] text-muted mb-4">AGENT STATUS</div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.length === 0 ? (
          <div className="glass-card p-6 col-span-full">
            <div className="text-center text-muted">No agents currently active</div>
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.name} className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-lg">{agent.name}</h3>
                <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-mint' : 'bg-red'}`} />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Status</span>
                  <span className={agent.status === 'active' ? 'text-mint' : 'text-red'}>
                    {agent.status}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Tasks Completed</span>
                  <span>{agent.tasks_completed || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Last Active</span>
                  <span>{agent.last_active || 'Never'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
