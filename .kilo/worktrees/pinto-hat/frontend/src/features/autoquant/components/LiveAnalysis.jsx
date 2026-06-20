/**
 * LiveAnalysis Component
 * Displays real-time analysis progress with logs
 */

import React, { useState, useEffect, useRef } from 'react';

export default function LiveAnalysis({ runId }) {
  const [logs, setLogs] = useState([]);
  const [currentStage, setCurrentStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({
    generated: 0,
    tested: 0,
    rejected: 0,
    surviving: 0,
  });
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!runId) return;

    // In a real implementation, this would connect to WebSocket
    // For now, simulate with mock data
    const interval = setInterval(() => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Processing stage ${currentStage}...`]);
      setProgress(prev => Math.min(prev + 5, 100));
    }, 2000);

    return () => clearInterval(interval);
  }, [runId, currentStage]);

  useEffect(() => {
    // Auto-scroll to bottom of logs
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Live Analysis</h2>
        
        {/* Current Stage */}
        <div className="alert alert-info">
          <div>
            <h3 className="font-bold">Current Stage: {currentStage || 'Initializing'}</h3>
            <div className="text-sm">Progress: {progress}%</div>
          </div>
          <progress className="progress" value={progress} max="100"></progress>
        </div>

        {/* Statistics */}
        <div className="stats stats-horizontal shadow">
          <div className="stat">
            <div className="stat-title">Generated</div>
            <div className="stat-value">{stats.generated}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Tested</div>
            <div className="stat-value">{stats.tested}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Rejected</div>
            <div className="stat-value text-error">{stats.rejected}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Surviving</div>
            <div className="stat-value text-success">{stats.surviving}</div>
          </div>
        </div>

        {/* Logs */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-bold">Live Logs</span>
          </label>
          <div className="h-64 bg-base-200 rounded-lg p-4 overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
