// API client with TanStack Query hooks
import type {
  Run,
  Strategy,
  CreateRunRequest,
  ApprovePairsRequest,
  ControlRunRequest,
  PairMetrics,
  Results,
  AISuggestion,
} from './autoquant.types';

const API_BASE = '/api/auto-quant';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error: ${response.status}`);
  }

  return response.json();
}

// Query hooks
export async function fetchRuns(): Promise<Run[]> {
  const response = await fetch(`${API_BASE}/runs`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.runs || [];
}

export async function fetchRun(runId: string): Promise<Run> {
  return fetchAPI<Run>(`/runs/${runId}`);
}

export async function fetchStrategies(): Promise<Strategy[]> {
  const response = await fetch('/api/strategies', {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.strategies || [];
}

export async function fetchPairs(runId: string): Promise<PairMetrics[]> {
  return fetchAPI<PairMetrics[]>(`/runs/${runId}/pairs`);
}

export async function fetchResults(runId: string): Promise<Results> {
  return fetchAPI<Results>(`/runs/${runId}/results`);
}

export async function fetchAISuggestions(runId: string): Promise<AISuggestion> {
  return fetchAPI<AISuggestion>(`/runs/${runId}/ai/suggest`);
}

// Mutation functions
export async function createRun(request: CreateRunRequest): Promise<Run> {
  return fetchAPI<Run>('/runs', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function approvePairs(runId: string, request: ApprovePairsRequest): Promise<void> {
  return fetchAPI<void>(`/runs/${runId}/approve-pairs`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function controlRun(runId: string, request: ControlRunRequest): Promise<void> {
  return fetchAPI<void>(`/runs/${runId}/${request.action}`, {
    method: 'POST',
  });
}

// Download helper
export function downloadFile(runId: string, filename: string): void {
  const url = `${API_BASE}/runs/${runId}/download/${filename}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// AI Chat
export async function sendAIChatMessage(runId: string, message: string): Promise<ReadableStream> {
  const response = await fetch(`${API_BASE}/runs/${runId}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`AI chat error: ${response.status}`);
  }

  return response.body!;
}
