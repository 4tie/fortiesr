/**
 * ReportExport Component
 * Handles report generation and export (PDF/JSON/CSV)
 */

import { useState } from 'react';

export default function ReportExport({ runId, strategyData }) {
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState('json');

  const handleExport = async () => {
    setExporting(true);
    try {
      // In real implementation, would call API to generate report
      const data = format === 'json' ? JSON.stringify(strategyData, null, 2) : strategyData;
      
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${runId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Export Report</h2>
        
        <div className="form-control">
          <label className="label">
            <span className="label-text">Export Format</span>
          </label>
          <select
            className="select select-bordered"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <div className="card-actions justify-end">
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? <span className="loading loading-spinner"></span> : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
