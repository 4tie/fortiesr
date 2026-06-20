/**
 * StrategyGenerator Component
 * Handles AI-powered strategy generation
 */

import React, { useState, useCallback } from 'react';
import autoQuantAPI from '../services/autoQuantAPI';

export default function StrategyGenerator({ onGenerate }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState({
    tradingStyle: 'swing',
    riskProfile: 'balanced',
    exchange: 'binance',
    count: 10,
    timeframe: null,
  });

  const handleGenerate = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);

      const result = await autoQuantAPI.generateStrategies(config);
      
      if (onGenerate) {
        onGenerate(result);
      }
    } catch (err) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [config, onGenerate]);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Generate Strategies</h2>
        
        <div className="form-control">
          <label className="label">
            <span className="label-text">Trading Style</span>
          </label>
          <select
            className="select select-bordered"
            value={config.tradingStyle}
            onChange={(e) => setConfig({ ...config, tradingStyle: e.target.value })}
          >
            <option value="scalping">Scalping (1m-5m)</option>
            <option value="intraday">Intraday (15m-1h)</option>
            <option value="swing">Swing (1h-4h)</option>
            <option value="position">Position (1d+)</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Risk Profile</span>
          </label>
          <select
            className="select select-bordered"
            value={config.riskProfile}
            onChange={(e) => setConfig({ ...config, riskProfile: e.target.value })}
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Exchange</span>
          </label>
          <select
            className="select select-bordered"
            value={config.exchange}
            onChange={(e) => setConfig({ ...config, exchange: e.target.value })}
          >
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
            <option value="okx">OKX</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Number of Strategies</span>
          </label>
          <input
            type="number"
            min="1"
            max="100"
            className="input input-bordered"
            value={config.count}
            onChange={(e) => setConfig({ ...config, count: parseInt(e.target.value) })}
          />
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="card-actions justify-end">
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <span className="loading loading-spinner"></span> : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
