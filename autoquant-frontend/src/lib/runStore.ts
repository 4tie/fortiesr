// Zustand store for run state
import { create } from 'zustand';
import type {
  LogEntry,
  FitnessPoint,
  Stage,
  PairMetrics,
  Results,
  RunStatus,
} from './autoquant.types';

interface RunState {
  logs: LogEntry[];
  fitness: FitnessPoint[];
  currentStage: Stage | null;
  pairs: PairMetrics[];
  results: Results | null;
  status: RunStatus;
  progress: number;
  etaSeconds?: number;
  
  // Actions
  addLog: (log: LogEntry) => void;
  addFitnessPoint: (point: FitnessPoint) => void;
  setCurrentStage: (stage: Stage) => void;
  setPairs: (pairs: PairMetrics[]) => void;
  setResults: (results: Results) => void;
  setStatus: (status: RunStatus) => void;
  setProgress: (progress: number) => void;
  setEtaSeconds: (eta: number | undefined) => void;
  clear: () => void;
}

export const useRunStore = create<RunState>((set) => ({
  logs: [],
  fitness: [],
  currentStage: null,
  pairs: [],
  results: null,
  status: 'pending',
  progress: 0,
  
  addLog: (log) => set((state) => ({ 
    logs: [...state.logs, log].slice(-1000) // Keep last 1000 logs
  })),
  
  addFitnessPoint: (point) => set((state) => ({ 
    fitness: [...state.fitness, point]
  })),
  
  setCurrentStage: (stage) => set({ currentStage: stage }),
  
  setPairs: (pairs) => set({ pairs }),
  
  setResults: (results) => set({ results }),
  
  setStatus: (status) => set({ status }),
  
  setProgress: (progress) => set({ progress }),
  
  setEtaSeconds: (etaSeconds) => set({ etaSeconds }),
  
  clear: () => set({
    logs: [],
    fitness: [],
    currentStage: null,
    pairs: [],
    results: null,
    status: 'pending',
    progress: 0,
    etaSeconds: undefined,
  }),
}));
