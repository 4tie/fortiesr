/**
 * ExportReport Component
 * Provides buttons to export pipeline run in various formats
 */

import { useState } from 'react';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { exportReport } from '../services/reportService';

export function ExportReportButtons({ run }) {
  const [exporting, setExporting] = useState(null);

  const handleExport = async (format) => {
    try {
      setExporting(format);
      exportReport(run, format);
    } catch (err) {
      console.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const exportFormats = [
    {
      id: 'json',
      label: 'JSON',
      description: 'Structured data format',
      mimeType: 'application/json',
    },
    {
      id: 'csv',
      label: 'CSV',
      description: 'Spreadsheet format',
      mimeType: 'text/csv',
    },
    {
      id: 'txt',
      label: 'Text',
      description: 'Human-readable format',
      mimeType: 'text/plain',
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {exportFormats.map((format) => (
        <button
          key={format.id}
          onClick={() => handleExport(format.id)}
          disabled={exporting === format.id}
          className="btn btn-sm btn-outline gap-2"
          title={format.description}
        >
          {exporting === format.id ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Exporting...
            </>
          ) : (
            <>
              <DocumentArrowDownIcon className="w-4 h-4" />
              {format.label}
            </>
          )}
        </button>
      ))}
    </div>
  );
}

export default ExportReportButtons;
