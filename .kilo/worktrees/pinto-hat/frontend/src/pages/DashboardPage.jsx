/**
 * DashboardPage - Overview Dashboard
 * Displays overall score, current status, and statistics
 */

import React from 'react';
import { useAppContext } from '../context/AppContext';

export default function DashboardPage() {
  const { userSettings } = useAppContext();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">AutoQuant Dashboard</h1>
      
      {/* Overview Stats */}
      <div className="stats stats-vertical lg:stats-horizontal w-full shadow mb-6">
        <div className="stat">
          <div className="stat-title">Overall Score</div>
          <div className="stat-value text-primary">85.4</div>
          <div className="stat-desc">Elite strategies</div>
        </div>
        
        <div className="stat">
          <div className="stat-title">Current Status</div>
          <div className="stat-value text-success">Active</div>
          <div className="stat-desc">System operational</div>
        </div>
        
        <div className="stat">
          <div className="stat-title">Strategies Generated</div>
          <div className="stat-value">1,247</div>
          <div className="stat-desc">Total generated</div>
        </div>
        
        <div className="stat">
          <div className="stat-title">Strategies Tested</div>
          <div className="stat-value">892</div>
          <div className="stat-desc">Completed backtests</div>
        </div>
        
        <div className="stat">
          <div className="stat-title">Strategies Survived</div>
          <div className="stat-value text-warning">47</div>
          <div className="stat-desc">Passed validation</div>
        </div>
        
        <div className="stat">
          <div className="stat-title">Elite Count</div>
          <div className="stat-value text-error">3</div>
          <div className="stat-desc">Deployment-ready</div>
        </div>
      </div>

      {/* Current Configuration */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Current Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat">
              <div className="stat-title">Trading Style</div>
              <div className="stat-value capitalize">{userSettings.tradingStyle}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Risk Profile</div>
              <div className="stat-value capitalize">{userSettings.riskProfile}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Exchange</div>
              <div className="stat-value capitalize">{userSettings.exchange}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Recent Activity</h2>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Strategy</th>
                  <th>Status</th>
                  <th>Stage</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>run-001</td>
                  <td>RSI Scalper #1</td>
                  <td><span className="badge badge-success">Completed</span></td>
                  <td>Ranking</td>
                  <td>2 hours ago</td>
                </tr>
                <tr>
                  <td>run-002</td>
                  <td>EMA Crossover #5</td>
                  <td><span className="badge badge-warning">Running</span></td>
                  <td>Validation</td>
                  <td>1 hour ago</td>
                </tr>
                <tr>
                  <td>run-003</td>
                  <td>MACD Swing #2</td>
                  <td><span className="badge badge-error">Failed</span></td>
                  <td>Discovery</td>
                  <td>30 mins ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
