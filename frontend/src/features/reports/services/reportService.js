/**
 * Reporting Service - Generate professional strategy reports
 * Supports: PDF, JSON, CSV exports
 */

/**
 * Generate JSON report
 */
export function generateJsonReport(run) {
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      runId: run.run_id,
      strategy: run.strategy_name,
    },
    pipeline: {
      status: run.status,
      progress: run.progress,
      currentStage: run.current_stage,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      elapsedSeconds: run.elapsed_seconds,
    },
    results: {
      candidates: run.candidates?.length || 0,
      promising: run.promising?.length || 0,
      validated: run.validated?.length || 0,
      elite: run.elite?.length || 0,
    },
    errors: run.errors || [],
    strategies: {
      candidates: run.candidates || [],
      promising: run.promising || [],
      validated: run.validated || [],
      elite: run.elite || [],
    },
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Generate CSV report
 */
export function generateCsvReport(run) {
  const headers = [
    'Strategy Name',
    'Status',
    'Tier',
    'Score',
    'Profit Factor',
    'Drawdown',
    'Win Rate',
    'Trades',
    'Expectancy',
    'Sharpe Ratio',
  ];

  const rows = [];

  // Add elite strategies
  if (run.elite && run.elite.length > 0) {
    run.elite.forEach((strategy) => {
      rows.push([
        strategy.name,
        strategy.status,
        strategy.tier,
        strategy.score?.toFixed(2) || '',
        strategy.metrics?.profitFactor?.toFixed(2) || '',
        (strategy.metrics?.drawdown * 100)?.toFixed(1) || '',
        (strategy.metrics?.winRate * 100)?.toFixed(1) || '',
        strategy.metrics?.trades || '',
        strategy.metrics?.expectancy?.toFixed(4) || '',
        strategy.metrics?.sharpeRatio?.toFixed(2) || '',
      ]);
    });
  }

  // Add validated strategies
  if (run.validated && run.validated.length > 0) {
    run.validated.forEach((strategy) => {
      rows.push([
        strategy.name,
        strategy.status,
        strategy.tier,
        strategy.score?.toFixed(2) || '',
        strategy.metrics?.profitFactor?.toFixed(2) || '',
        (strategy.metrics?.drawdown * 100)?.toFixed(1) || '',
        (strategy.metrics?.winRate * 100)?.toFixed(1) || '',
        strategy.metrics?.trades || '',
        strategy.metrics?.expectancy?.toFixed(4) || '',
        strategy.metrics?.sharpeRatio?.toFixed(2) || '',
      ]);
    });
  }

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  return csv;
}

/**
 * Generate PDF report (basic)
 * Note: This is a simplified version. For production, use jsPDF or similar.
 */
export function generatePdfReport(run) {
  const lines = [
    '='.repeat(80),
    'AUTO-QUANT STRATEGY EVALUATION REPORT',
    '='.repeat(80),
    '',
    `Report Generated: ${new Date().toLocaleString()}`,
    `Pipeline Run ID: ${run.run_id}`,
    `Strategy: ${run.strategy_name}`,
    `Status: ${run.status.toUpperCase()}`,
    '',
    'SUMMARY',
    '-'.repeat(80),
    `Candidates Found: ${run.candidates?.length || 0}`,
    `Promising Strategies: ${run.promising?.length || 0}`,
    `Validated Strategies: ${run.validated?.length || 0}`,
    `Elite Strategies: ${run.elite?.length || 0}`,
    '',
  ];

  // Add elite strategies details
  if (run.elite && run.elite.length > 0) {
    lines.push('ELITE STRATEGIES (RANKED BY SCORE)');
    lines.push('-'.repeat(80));
    run.elite.forEach((strategy, index) => {
      lines.push(`${index + 1}. ${strategy.name} (Score: ${strategy.score?.toFixed(2)})`);
      lines.push(`   Status: ${strategy.status}`);
      lines.push(`   Profit Factor: ${strategy.metrics?.profitFactor?.toFixed(2)}`);
      lines.push(`   Drawdown: ${(strategy.metrics?.drawdown * 100)?.toFixed(1)}%`);
      lines.push(`   Win Rate: ${(strategy.metrics?.winRate * 100)?.toFixed(1)}%`);
      lines.push(`   Trades: ${strategy.metrics?.trades}`);
      lines.push('');
    });
  }

  if (run.errors && run.errors.length > 0) {
    lines.push('ERRORS');
    lines.push('-'.repeat(80));
    run.errors.forEach((error) => {
      lines.push(`• ${error}`);
    });
    lines.push('');
  }

  lines.push('='.repeat(80));
  lines.push('End of Report');
  lines.push('='.repeat(80));

  return lines.join('\n');
}

/**
 * Download file helper
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export report in specified format
 */
export function exportReport(run, format = 'json') {
  const timestamp = new Date().toISOString().split('T')[0];
  const baseName = `report-${run.strategy_name}-${timestamp}`;

  switch (format) {
    case 'json': {
      const content = generateJsonReport(run);
      downloadFile(content, `${baseName}.json`, 'application/json');
      break;
    }
    case 'csv': {
      const content = generateCsvReport(run);
      downloadFile(content, `${baseName}.csv`, 'text/csv');
      break;
    }
    case 'txt': {
      const content = generatePdfReport(run);
      downloadFile(content, `${baseName}.txt`, 'text/plain');
      break;
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
