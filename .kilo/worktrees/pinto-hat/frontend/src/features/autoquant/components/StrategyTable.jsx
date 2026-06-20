/**
 * StrategyTable Component
 * Displays strategies with filters, sorting, and search
 */

import React, { useState, useMemo } from 'react';

export default function StrategyTable({ strategies }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredStrategies = useMemo(() => {
    let filtered = strategies || [];

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply tier filter
    if (filterTier !== 'all') {
      filtered = filtered.filter(s => s.tier === filterTier);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      
      if (sortOrder === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    return filtered;
  }, [strategies, searchTerm, filterTier, sortBy, sortOrder]);

  const getTierBadge = (tier) => {
    const colors = {
      candidate: 'badge-neutral',
      promising: 'badge-info',
      validated: 'badge-success',
      elite: 'badge-warning',
    };
    return colors[tier] || 'badge-neutral';
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Strategies</h2>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search strategies..."
            className="input input-bordered input-sm flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <select
            className="select select-bordered select-sm"
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
          >
            <option value="all">All Tiers</option>
            <option value="candidate">Candidate</option>
            <option value="promising">Promising</option>
            <option value="validated">Validated</option>
            <option value="elite">Elite</option>
          </select>
          
          <select
            className="select select-bordered select-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="score">Score</option>
            <option value="profitFactor">Profit Factor</option>
            <option value="drawdown">Drawdown</option>
            <option value="expectancy">Expectancy</option>
            <option value="trades">Trades</option>
          </select>
          
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tier</th>
                <th>Score</th>
                <th>PF</th>
                <th>DD</th>
                <th>Exp</th>
                <th>Trades</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStrategies.map((strategy) => (
                <tr key={strategy.id}>
                  <td>{strategy.name}</td>
                  <td>
                    <div className={`badge ${getTierBadge(strategy.tier)}`}>
                      {strategy.tier}
                    </div>
                  </td>
                  <td>{strategy.score?.toFixed(1) || '-'}</td>
                  <td>{strategy.metrics?.profitFactor?.toFixed(2) || '-'}</td>
                  <td>{strategy.metrics?.drawdown?.toFixed(2) || '-'}%</td>
                  <td>{strategy.metrics?.expectancy?.toFixed(6) || '-'}</td>
                  <td>{strategy.metrics?.trades || '-'}</td>
                  <td>{strategy.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStrategies.length === 0 && (
          <div className="text-center py-8 text-opacity-50">
            No strategies found
          </div>
        )}
      </div>
    </div>
  );
}
