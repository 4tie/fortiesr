import { useState, useEffect, useCallback } from 'react';
import ErrorDisplay from './shared/ErrorDisplay';

export default function AgentsTab() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pipelineState, setPipelineState] = useState(null);
  const [activeAgent, setActiveAgent] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchAgentStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/agent/status');
      if (!response.ok) {
        throw new Error(`Failed to fetch agent status: ${response.statusText}`);
      }
      const data = await response.json();
      setAgents(data.agents || []);
      setPipelineState(data.pipeline_state || null);
      setActiveAgent(data.active_agent || null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    const load = async () => {
      await fetchAgentStatus();
    };
    load();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAgentStatus();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusColor = (status) => {
    const lowerStatus = status?.toLowerCase() || '';
    if (lowerStatus === 'active' || lowerStatus === 'processing' || lowerStatus === 'scanning' || lowerStatus === 'analyzing' || lowerStatus === 'logging') {
      return 'bg-mint';
    }
    if (lowerStatus === 'idle' || lowerStatus === 'monitoring') {
      return 'bg-cyan';
    }
    return 'bg-red';
  };

  const getStatusTextColor = (status) => {
    const lowerStatus = status?.toLowerCase() || '';
    if (lowerStatus === 'active' || lowerStatus === 'processing' || lowerStatus === 'scanning' || lowerStatus === 'analyzing' || lowerStatus === 'logging') {
      return 'text-mint';
    }
    if (lowerStatus === 'idle' || lowerStatus === 'monitoring') {
      return 'text-cyan';
    }
    return 'text-red';
  };

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
        <div>
          <div className="font-mono text-[10px] text-muted mb-1">AGENT STATUS</div>
          {pipelineState && (
            <div className="text-xs text-muted">
              Pipeline: {pipelineState.status} {pipelineState.strategy && `• ${pipelineState.strategy}`}
            </div>
          )}
        </div>
        <button
          onClick={fetchAgentStatus}
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
          onRetry={fetchAgentStatus}
        />
      )}

      {loading && agents.length === 0 ? (
        <div className="glass-card p-6">
          <div className="text-center text-muted">Loading agent status...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.length === 0 ? (
            <div className="glass-card p-6 col-span-full">
              <div className="text-center text-muted">No agents currently active</div>
            </div>
          ) : (
            agents.map((agent) => (
              <div 
                key={agent.name} 
                className={`glass-card p-6 transition-all ${agent.name === activeAgent ? 'border-mint/50' : ''}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-lg">{agent.name}</h3>
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Status</span>
                    <span className={getStatusTextColor(agent.status)}>
                      {agent.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Tasks Completed</span>
                    <span>{agent.tasks_completed || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Responses</span>
                    <span>{agent.responses || 0}</span>
                  </div>
                  {agent.current_task && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Current Task</span>
                      <span className="text-right text-xs max-w-[120px] truncate">{agent.current_task}</span>
                    </div>
                  )}
                </div>

                {agent.name === activeAgent && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <span className="text-xs text-mint font-medium">● Active</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {lastRefresh && (
        <div className="text-xs text-muted text-center">
          Last updated: {formatLastRefresh(lastRefresh)}
        </div>
      )}
    </div>
  );
}
