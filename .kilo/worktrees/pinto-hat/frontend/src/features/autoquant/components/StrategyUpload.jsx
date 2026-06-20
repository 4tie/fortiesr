/**
 * StrategyUpload Component
 * Handles strategy file upload with validation
 */

import React, { useState, useCallback } from 'react';
import autoQuantAPI from '../services/autoQuantAPI';

export default function StrategyUpload({ onUpload }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({
    name: '',
    timeframe: '4h',
    pairs: [],
  });

  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const result = await autoQuantAPI.uploadStrategy(file, metadata);
      
      if (onUpload) {
        onUpload(result);
      }

      setFile(null);
      setMetadata({ name: '', timeframe: '4h', pairs: [] });
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [file, metadata, onUpload]);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Upload Strategy</h2>
        
        <div className="form-control">
          <label className="label">
            <span className="label-text">Strategy Name</span>
          </label>
          <input
            type="text"
            placeholder="Enter strategy name"
            className="input input-bordered"
            value={metadata.name}
            onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Timeframe</span>
          </label>
          <select
            className="select select-bordered"
            value={metadata.timeframe}
            onChange={(e) => setMetadata({ ...metadata, timeframe: e.target.value })}
          >
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Strategy File (.py)</span>
          </label>
          <input
            type="file"
            accept=".py"
            className="file-input file-input-bordered"
            onChange={handleFileChange}
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
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? <span className="loading loading-spinner"></span> : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
