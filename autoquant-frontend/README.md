# AutoQuant Frontend

A production-ready React frontend for the AutoQuant trading strategy optimization pipeline, featuring a dark glassmorphism UI with neon accents and real-time WebSocket updates.

## Tech Stack

- **React 19** - Latest React with concurrent features
- **TanStack Start** - File-based routing with TanStack Router
- **Vite 7** - Fast build tool and dev server
- **TailwindCSS v4** - Utility-first CSS with custom design tokens
- **TanStack Query** - Server state management and caching
- **Recharts** - Responsive charting library
- **Zustand** - Lightweight state management
- **Zod** - Schema validation
- **Framer Motion** - Smooth animations
- **Native WebSocket** - Real-time updates with auto-reconnect

## Design System

The frontend uses a dark glassmorphism design with neon accents:

- **Colors**: oklch color tokens for background, surface, primary, accent, success, warning, destructive
- **Effects**: Glass blur, neon rings, pulse animations
- **Typography**: Space Grotesk (display) and JetBrains Mono (code)
- **Components**: Custom glass cards with backdrop blur and subtle borders

## Project Structure

```
autoquant-frontend/
├── src/
│   ├── components/
│   │   └── autoquant/
│   │       ├── StageStepper.tsx      # Pipeline stage visualization
│   │       ├── LogTerminal.tsx        # Real-time log viewer
│   │       ├── FitnessChart.tsx       # Hyperopt fitness curve
│   │       ├── PairTable.tsx          # Pair selection table
│   │       ├── EquityChart.tsx        # Equity curve visualization
│   │       ├── TradeDistribution.tsx   # Trade P&L distribution
│   │       ├── WFOTable.tsx           # Walk-forward optimization table
│   │       └── DownloadButtons.tsx    # File download buttons
│   ├── lib/
│   │   ├── autoquant.types.ts         # TypeScript type definitions
│   │   ├── api.ts                     # API client with TanStack Query
│   │   ├── useAutoQuantSocket.ts      # WebSocket hook with reconnection
│   │   ├── runStore.ts                # Zustand store for run state
│   │   └── format.ts                  # Formatting utilities
│   ├── routes/
│   │   ├── __root.tsx                 # Root layout with navigation
│   │   ├── index.tsx                  # Runs list page
│   │   ├── runs.new.tsx               # New run configuration form
│   │   ├── runs.$runId.tsx            # Run layout with tabs
│   │   ├── runs.$runId.index.tsx      # Pipeline dashboard
│   │   ├── runs.$runId.pairs.tsx      # Pair selection
│   │   ├── runs.$runId.results.tsx    # Results page
│   │   └── runs.$runId.chat.tsx       # AI chat interface
│   ├── styles.css                     # Design system and custom utilities
│   ├── router.tsx                     # TanStack Router configuration
│   ├── main.tsx                       # Application entry point
│   └── index.html                     # HTML template
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript configuration
├── vite.config.ts                     # Vite configuration
└── README.md                          # This file
```

## Routes

- `/` - List all AutoQuant runs
- `/runs/new` - Create a new optimization run
- `/runs/:runId` - Run detail page with tabs:
  - Dashboard - Pipeline progress, fitness curve, logs
  - Pairs - Pair selection and approval
  - Results - Performance metrics, charts, downloads
  - AI Chat - Conversational AI assistant

## Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Configuration

The frontend expects the FastAPI backend to be running at `http://localhost:8000`. The Vite proxy is configured to forward API and WebSocket requests:

- `/api/auto-quant/*` → `http://localhost:8000/api/auto-quant/*`
- `/api/auto-quant/runs/:id/ws` → `ws://localhost:8000/api/auto-quant/runs/:id/ws`

## Features

### Real-time Updates
- WebSocket connection for live run status
- Auto-reconnection with exponential backoff
- Zustand store for efficient state updates

### Pipeline Dashboard
- Stage stepper showing pipeline progress
- Fitness curve visualization
- Real-time log terminal with filtering
- Progress tracking with ETA

### Pair Selection
- Sortable table with performance metrics
- Bulk select/deselect functionality
- Approval workflow for pair universe

### Results Page
- Metric cards with key performance indicators
- Equity curve chart
- Trade P&L distribution
- Walk-forward optimization windows
- Download buttons for strategy, JSON, and PDF reports

### AI Chat
- Streaming markdown responses
- LocalStorage persistence
- Context-aware assistance

## Build

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Keyboard Shortcuts

- `Ctrl/Cmd + K` - Quick navigation (planned)
- `Ctrl/Cmd + /` - Command palette (planned)

## Development Notes

- All TypeScript errors are expected until dependencies are installed
- The `@theme` CSS rule is a Tailwind v4 feature for custom design tokens
- WebSocket messages are typed for type safety
- API client uses TanStack Query for caching and optimistic updates
