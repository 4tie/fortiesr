# ARCHITECTURE PLAN (PROPOSAL)
Generated: 2026-06-10

**Status**: Proposal stage - no implementation yet
**Next Step**: User review and approval before proceeding

---

## 1. CURRENT ARCHITECTURE STATE

### Frontend (Current)
```
frontend/src/
├── main.jsx                    # Entry point
├── App.jsx                     # Router + state manager (265 lines, TOO BIG)
├── index.css                   # Tailwind base
├── components/                 # 27 JSX files, flat structure
├── hooks/                      # 4 hooks (implicit contracts)
└── (no further structure)
```

**Issues**:
- App.jsx combines routing + state management
- All 27 components in single flat folder
- No feature organization
- Hooks have implicit API contracts
- No API abstraction layer
- Direct fetch calls scattered in components

### Backend (Current)
```
backend/
├── api/routers/                # 19 routers with embedded logic
├── services/                   # 14+ services (some 1,700+ lines)
├── models/                     # Data contracts
├── core/                       # Errors only
├── tests/                      # 19 test files
└── (no repositories, validators, or executors)
```

**Issues**:
- Router logic bloated (auto_quant.py: 915 lines)
- Services have mixed concerns (ollama_service.py: 1,762 lines)
- No repository pattern (file I/O scattered)
- No validators module (validation mixed into stages)
- No dependency injection (AppServices creates all 20+ services)
- God object: AppServices.py (100+ lines)

---

## 2. PROPOSED FRONTEND ARCHITECTURE

### New Folder Structure

```
frontend/src/
├── main.jsx                    # React entry point (unchanged)
├── App.jsx                     # Thin router ONLY
├── index.css                   # Tailwind base (unchanged)
│
├── app/                        # App-level layout
│   └── AppLayout.jsx           # Root layout component
│
├── pages/                      # Page containers (7+ major features)
│   ├── OptimizerPage.jsx
│   ├── BacktestPage.jsx
│   ├── StrategyEditorPage.jsx
│   ├── PerformancePage.jsx
│   ├── PairExplorerPage.jsx
│   ├── StressTestPage.jsx
│   ├── AutoQuantPage.jsx
│   └── SettingsPage.jsx
│
├── components/                 # Reusable UI components (dumb)
│   ├── Common/
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Modal.jsx
│   │   └── ... (basic UI)
│   ├── Layout/
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   └── Navigation.jsx
│   └── Forms/
│       ├── FormInput.jsx
│       ├── FormSelect.jsx
│       └── ... (form fields)
│
├── features/                   # Feature domains (thick, smart)
│   ├── autoquant/
│   │   ├── AutoQuantPage.jsx   # Page container
│   │   ├── components/
│   │   │   ├── PipelineStages.jsx
│   │   │   ├── StrategyTable.jsx
│   │   │   ├── StrategyDetails.jsx
│   │   │   └── LiveAnalysis.jsx
│   │   ├── hooks/
│   │   │   └── useAutoQuantState.js
│   │   ├── services/
│   │   │   └── autoQuantAPI.js
│   │   └── validators/
│   │       └── autoQuantValidators.js
│   │
│   ├── backtest/
│   │   ├── BacktestPage.jsx
│   │   ├── components/
│   │   │   ├── BacktestForm.jsx
│   │   │   └── ResultsView.jsx
│   │   ├── hooks/
│   │   │   └── useBacktestState.js
│   │   ├── services/
│   │   │   └── backtestAPI.js
│   │   └── validators/
│   │       └── backtestValidators.js
│   │
│   ├── charts/
│   │   ├── EquityCurveChart.jsx
│   │   ├── DrawdownChart.jsx
│   │   ├── ProfitDistributionChart.jsx
│   │   ├── TradeDistributionChart.jsx
│   │   ├── MonthlyReturnsChart.jsx
│   │   ├── PairHeatmapChart.jsx
│   │   ├── TimeframeComparisonChart.jsx
│   │   ├── WalkForwardChart.jsx
│   │   ├── ParameterSensitivityChart.jsx
│   │   ├── ScoreEvolutionChart.jsx
│   │   └── utils/
│   │       └── chartDataFormatter.js
│   │
│   ├── results/
│   │   ├── ResultsPage.jsx
│   │   ├── components/
│   │   │   ├── RunDetailPanel.jsx
│   │   │   └── RunHistoryDashboard.jsx
│   │   ├── hooks/
│   │   │   └── useResultsState.js
│   │   ├── services/
│   │   │   └── resultsAPI.js
│   │   └── validators/
│   │       └── resultsValidators.js
│   │
│   ├── strategy/
│   │   ├── StrategyPage.jsx
│   │   ├── components/
│   │   │   ├── StrategyEditor.jsx
│   │   │   ├── StrategyUpload.jsx
│   │   │   └── StrategyList.jsx
│   │   ├── hooks/
│   │   │   └── useStrategyState.js
│   │   ├── services/
│   │   │   └── strategyAPI.js
│   │   └── validators/
│   │       └── strategyValidators.js
│   │
│   ├── performance/
│   │   ├── PerformancePage.jsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── validators/
│   │
│   ├── pairexplorer/
│   │   ├── PairExplorerPage.jsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── validators/
│   │
│   └── settings/
│       ├── SettingsPage.jsx
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── validators/
│
├── context/                    # Global state
│   └── AppContext.js           # Theme, auth, notifications
│
├── hooks/                      # Global hooks ONLY
│   ├── useTheme.js
│   ├── useWebSocket.js
│   └── ... (shared hooks)
│
├── services/                   # API clients + utilities
│   ├── api.js                  # Central API client
│   ├── websocket.js            # WebSocket manager
│   └── ... (shared services)
│
├── types/                      # Type definitions
│   ├── models.js               # Domain models (Strategy, etc)
│   ├── api.js                  # API request/response types
│   └── domain.js               # Domain-specific types
│
├── utils/                      # Utility functions
│   ├── formatters.js           # Date, number, currency formatters
│   ├── validators.js           # Global validators
│   ├── helpers.js              # Helper functions
│   └── constants.js            # Constants
│
├── styles/                     # Global styles
│   ├── components.css          # Tailwind component classes
│   ├── utilities.css           # Utility classes
│   └── animations.css          # Animations
│
└── assets/                     # Images, icons, etc
    ├── images/
    ├── icons/
    └── ...
```

### Key Principles

1. **Separation of Concerns**:
   - `components/Common/` = Dumb UI components
   - `features/*/components/` = Smart, feature-specific components
   - `features/*/services/` = Feature API calls
   - `features/*/hooks/` = Feature state management
   - `features/*/validators/` = Feature-specific validation rules

2. **Data Flow**:
   ```
   Component → Hook (useFeatureState) → Service (API) → Backend
   Component ← Hook ← Service Response ← Backend
   ```

3. **API Abstraction**:
   - Central `services/api.js` handles all HTTP
   - Components never call fetch() directly
   - Allows easy mocking for tests

4. **Feature Self-Contained**:
   - Each feature in `features/*/` is mostly independent
   - New feature = add new folder, no App.jsx changes
   - Clear boundaries between features

---

## 3. PROPOSED BACKEND ARCHITECTURE

### New Folder Structure

```
backend/
├── main.py                     # Entry point (clean, minimal)
├── runtime.py                  # Service factory
│
├── core/                       # Shared core
│   ├── errors.py               # Exception hierarchy
│   ├── config.py               # Centralized config (NEW)
│   ├── types.py                # Common types
│   └── constants.py            # Constants
│
├── api/                        # HTTP layer (THIN)
│   ├── app.py                  # FastAPI factory
│   ├── middleware/             # CORS, rate limiting
│   ├── dependencies/           # FastAPI Depends() helpers
│   └── routers/                # Thin routers (validation + delegation)
│       ├── auto_quant.py       # ~50 lines (was 915)
│       ├── backtest.py
│       ├── strategy.py
│       ├── results.py
│       ├── pair_explorer.py
│       ├── performance.py
│       ├── stress_test.py
│       └── ... (other routers)
│
├── services/                   # Business logic (THICK)
│   ├── auto_quant_service.py   # Orchestration
│   ├── backtest_service.py
│   ├── strategy_service.py
│   ├── validation_service.py
│   ├── ranking_service.py
│   ├── result_service.py
│   ├── pair_service.py
│   ├── performance_service.py
│   ├── settings_service.py
│   └── system_service.py
│
├── engine/                     # Pure business logic (NEW)
│   ├── strategy_generator.py
│   ├── strategy_scorer.py
│   ├── discovery_engine.py
│   ├── validation_engine.py
│   ├── elite_validation_engine.py
│   ├── elite_ranking_engine.py
│   ├── backtest_engine.py
│   ├── report_generator.py
│   └── ... (other engine modules)
│
├── repositories/               # Data access layer (NEW)
│   ├── result_repository.py
│   ├── run_repository.py
│   ├── optimizer_repository.py
│   ├── pair_repository.py
│   ├── strategy_repository.py
│   ├── settings_repository.py
│   └── ... (other repos)
│
├── validators/                 # Validation rules (NEW)
│   ├── backtest_validator.py
│   ├── strategy_validator.py
│   ├── data_validator.py
│   ├── threshold_validator.py
│   └── ... (other validators)
│
├── executors/                  # External integrations (NEW)
│   ├── backtest_executor.py    # Freqtrade wrapper
│   ├── pair_sweep_executor.py
│   ├── data_download_executor.py
│   ├── ai_executor.py          # Ollama wrapper
│   └── ... (other executors)
│
├── models/                     # Data models
│   ├── domain/                 # Core business objects
│   │   ├── strategy.py         # Strategy domain model
│   │   ├── result.py           # Result domain model
│   │   ├── backtest.py
│   │   ├── validation.py
│   │   ├── pair.py
│   │   └── ... (other domain models)
│   └── api/                    # Request/response schemas
│       ├── requests.py         # Pydantic input models
│       └── responses.py        # Pydantic output models
│
├── config/                     # Configuration (NEW)
│   ├── thresholds/
│   │   ├── scalping.json
│   │   ├── intraday.json
│   │   ├── swing.json
│   │   └── position.json
│   └── settings.json           # App configuration
│
├── services/auto_quant/        # Auto-Quant domain (refactored)
│   ├── pipeline_orchestrator.py
│   ├── strategy_generator.py
│   ├── strategy_scorer.py      # NEW: Extracted from ollama_service
│   ├── discovery_stage.py
│   ├── validation_stage.py
│   ├── elite_validation_stage.py
│   ├── elite_ranking.py
│   ├── data_healer.py
│   ├── sensitivity_analyzer.py
│   ├── profit_locker.py
│   ├── monte_carlo.py
│   ├── ai_client.py            # NEW: Ollama calls ONLY
│   └── validators.py
│
├── tests/                      # Tests reorganized
│   ├── unit/                   # Pure unit tests
│   │   ├── test_engine/
│   │   ├── test_validators/
│   │   └── ... (other units)
│   ├── integration/            # Services + repositories
│   │   ├── test_auto_quant_service.py
│   │   ├── test_backtest_service.py
│   │   └── ... (integration tests)
│   ├── e2e/                    # API endpoint tests
│   │   ├── test_auto_quant_endpoints.py
│   │   └── ... (E2E tests)
│   └── fixtures/               # Shared test data
│       ├── conftest.py
│       └── ... (fixtures)
│
├── stubs/                      # Type stubs (unchanged)
│   ├── freqtrade/
│   ├── pandas/
│   └── talib/
│
└── __init__.py
```

### Key Principles

1. **Layer Separation**:
   ```
   HTTP (API Layer, thin)
       ↓
   Service Layer (business logic, thick)
       ↓
   Engine Layer (pure logic, testable)
       ↓
   Repository Layer (data access)
   ```

2. **Thin Routers**:
   ```python
   # OLD (900 lines)
   @router.post("/auto-quant/run")
   async def run_auto_quant(request):
       # 200 lines of business logic
       return results
   
   # NEW (10 lines)
   @router.post("/auto-quant/run")
   async def run_auto_quant(request, service = Depends()):
       return await service.run(request)
   ```

3. **Engine Independence**:
   - Engine modules have NO dependencies on FastAPI
   - Engine modules have NO file I/O (repository interface instead)
   - Engine modules are 100% testable in isolation

4. **Validator Extraction**:
   - Validation rules moved from stages to `validators/` module
   - Configurable via `config/thresholds/`
   - Reusable across services

5. **Executor Pattern**:
   - External integrations (Freqtrade, Ollama) wrapped in executors
   - Single responsibility: call external tool, return results
   - Easy to mock or swap implementations

---

## 4. SEPARATION OF CONCERNS IMPLEMENTATION

### Concern 1: Engine Logic vs UI

**Before**:
```
Component → Fetch → Router → Service → File I/O
```

**After**:
```
Component → Hook → Feature Service → Engine (pure logic) ← Repositories
UI layer          Application layer  Domain logic      Data layer
```

**Benefits**:
- Engine code is testable without React
- Engine code is reusable (CLI, batch jobs, other UIs)
- Clear boundaries between layers

### Concern 2: Validation vs Rendering

**Before**:
```javascript
Component renders input → Component validates → Component updates
```

**After**:
```javascript
Validator module checks → Returns {valid, errors} → Component displays
```

**Benefits**:
- Validators are reusable (form + table + API)
- Validation rules can be documented separately
- Easy to test validators in isolation

### Concern 3: Strategy Generation vs Scoring

**Before**:
```python
ollama_service.py (1,762 lines)
├── Generate strategies
├── Score strategies
├── Validate data
├── Handle AI errors
└── (all mixed together)
```

**After**:
```python
strategy_generator.py        # Generate candidates
strategy_scorer.py           # Score candidates
ai_client.py                 # Ollama calls only
data_healer.py               # Data validation
validators.py               # Business rules
```

**Benefits**:
- Each module has single responsibility
- Easy to test each module independently
- Easy to swap generation or scoring logic

### Concern 4: API Concerns (Router vs Service)

**Before**:
```python
# auto_quant.py (915 lines)
@router.post("/run")
async def run(request):
    # Parse input
    # Call service (maybe)
    # Orchestrate pipeline
    # Parse results
    # Return response
```

**After**:
```python
# Router (50 lines)
@router.post("/run")
async def run(request, service=Depends()):
    return await service.run(request)

# Service (500 lines)
class AutoQuantService:
    async def run(self, request):
        # All orchestration here
        # Uses validators, engine, repositories
        # Returns domain objects
```

**Benefits**:
- Routers are thin and easy to understand
- Business logic in services (reusable)
- Easy to add new endpoints (just call existing service)

---

## 5. FEATURE BOUNDARIES

### Frontend Features (7)

| Feature | Page | Components | Services |
|---------|------|-----------|----------|
| AutoQuant | AutoQuantPage | PipelineStages, StrategyTable, StrategyDetails | autoQuantAPI |
| Backtest | BacktestPage | BacktestForm, ResultsView | backtestAPI |
| Strategy | StrategyPage | StrategyEditor, StrategyUpload | strategyAPI |
| Results | ResultsPage | RunDetailPanel, RunHistory | resultsAPI |
| Charts | (shared) | 10 chart components | chartDataFormatter |
| Performance | PerformancePage | Analytics components | performanceAPI |
| PairExplorer | PairExplorerPage | PairSelector, Analysis | pairAPI |

### Backend Services (9)

| Service | Purpose | Dependencies |
|---------|---------|--------------|
| auto_quant_service | Pipeline orchestration | engine, repositories, validators |
| backtest_service | Backtest execution | executor, repositories |
| strategy_service | Strategy CRUD + versioning | repositories, engine |
| validation_service | Discovery + validation | engine, repositories, executors |
| ranking_service | Elite ranking | engine, repositories |
| result_service | Result aggregation | repositories |
| pair_service | Pair analysis | repositories |
| performance_service | Analytics | repositories |
| system_service | Health + cleanup | repositories |

---

## 6. DATA MODEL UNIFICATION

### Frontend + Backend Types (Single Source of Truth)

```javascript
// frontend/src/types/models.js
export type Strategy = {
  id: string;
  name: string;
  code: string;
  timeframe: string;
  pairs: string[];
  status: 'draft' | 'validated' | 'elite';
  metrics: StrategyMetrics;
  createdAt: string;
  updatedAt: string;
};

export type StrategyMetrics = {
  profitFactor: number;
  drawdown: number;
  expectancy: number;
  trades: number;
  winRate: number;
  // ... other metrics
};

export type ValidationResult = {
  stage: string;
  passed: boolean;
  errors: string[];
  metrics: StrategyMetrics;
  timestamp: string;
};

// ... other types
```

```python
# backend/models/domain/strategy.py
from pydantic import BaseModel

class StrategyMetrics(BaseModel):
    profit_factor: float
    drawdown: float
    expectancy: float
    trades: int
    win_rate: float

class ValidationResult(BaseModel):
    stage: str
    passed: bool
    errors: List[str]
    metrics: StrategyMetrics
    timestamp: datetime

class Strategy(BaseModel):
    id: str
    name: str
    code: str
    timeframe: str
    pairs: List[str]
    status: Literal['draft', 'validated', 'elite']
    metrics: StrategyMetrics
    created_at: datetime
    updated_at: datetime
```

**Benefit**: Type definitions mirror each other, easier to maintain consistency.

---

## 7. STATE MANAGEMENT STRATEGY

### Frontend Global State
```javascript
// frontend/src/context/AppContext.js
{
  // Navigation
  navigation: { currentTab: 'autoquant' },
  
  // Theme
  theme: 'dark' | 'light',
  
  // User settings
  user: { 
    settings: { /* settings */ },
    preferences: { /* preferences */ }
  },
  
  // Global notifications
  toasts: [
    { id, message, type, duration }
  ],
  
  // Global loading
  isLoading: false,
  
  // Global error
  error: null,
}
```

### Feature State (Per Feature)
```javascript
// frontend/src/features/autoquant/hooks/useAutoQuantState.js
export function useAutoQuantState() {
  const [strategies, setStrategies] = useState([]);
  const [currentStage, setCurrentStage] = useState('discovery');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  
  return {
    strategies, setStrategies,
    currentStage, setCurrentStage,
    loading, setLoading,
    error, setError,
    progress, setProgress,
    logs, setLogs,
  };
}
```

**Principle**: Global state for app-level concerns, feature state for feature-specific data.

---

## 8. CONFIGURATION MANAGEMENT

### Backend Configuration (Centralized)

```python
# backend/core/config.py
from pathlib import Path
from typing import Literal
import json

class Config:
    # Paths
    DATA_DIR = Path("user_data")
    RESULTS_DIR = DATA_DIR / "backtest_results"
    
    # API
    API_HOST = os.getenv("API_HOST", "localhost")
    API_PORT = int(os.getenv("API_PORT", 8000))
    
    # Thresholds
    STRATEGY_TYPE = os.getenv("STRATEGY_TYPE", "swing")
    THRESHOLDS = self._load_thresholds()
    
    # Ollama
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    
    # Freqtrade
    FREQTRADE_DATA_DIR = os.getenv("FREQTRADE_DATA_DIR", "./data")
    
    @staticmethod
    def _load_thresholds(strategy_type: str):
        path = Path(__file__).parent.parent / "config" / f"thresholds/{strategy_type}.json"
        with open(path) as f:
            return json.load(f)
```

### Frontend Configuration

```javascript
// frontend/src/services/api.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// .env.local (not committed)
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000

// .env.production
VITE_API_BASE_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```

---

## 9. TESTING STRATEGY

### Frontend Tests (Target: 80% Coverage)
```
frontend/src/
├── components/
│   └── __tests__/
│       ├── Button.test.jsx
│       ├── Card.test.jsx
│       └── ... (all common components)
├── features/
│   ├── autoquant/
│   │   └── __tests__/
│   │       ├── AutoQuantPage.test.jsx
│   │       ├── StrategyTable.test.jsx
│   │       ├── hooks/useAutoQuantState.test.js
│   │       └── services/autoQuantAPI.test.js
│   └── ... (all features)
└── utils/
    └── __tests__/
        ├── formatters.test.js
        └── validators.test.js
```

### Backend Tests (Target: 70% Coverage)
```
backend/tests/
├── unit/
│   ├── engine/
│   │   ├── test_strategy_generator.py
│   │   ├── test_strategy_scorer.py
│   │   ├── test_discovery_engine.py
│   │   └── ... (all engine modules)
│   ├── validators/
│   │   └── test_*.py (all validators)
│   └── executors/
│       └── test_*.py (all executors)
├── integration/
│   ├── test_auto_quant_service.py
│   ├── test_backtest_service.py
│   ├── test_validation_service.py
│   └── ... (all services)
├── e2e/
│   ├── test_auto_quant_endpoints.py
│   ├── test_backtest_endpoints.py
│   └── ... (all endpoints)
└── fixtures/
    ├── conftest.py
    └── mock_data.py
```

---

## 10. MIGRATION STRATEGY (How to Implement)

### Phase 1: Setup (No Breaking Changes)
- [ ] Create new folder structure (parallel to old)
- [ ] Create new types (mirror backend models)
- [ ] Create new API client abstraction
- [ ] Create new validation rules module
- [ ] Old structure still works

### Phase 2: Feature by Feature
- [ ] Move AutoQuant feature to new structure
- [ ] Test thoroughly
- [ ] Move Backtest feature
- [ ] ... (one feature at a time)

### Phase 3: Cleanup
- [ ] Delete old folder structure
- [ ] Verify all imports updated
- [ ] Run full test suite

### Phase 4: Verify
- [ ] App builds successfully
- [ ] All tests pass
- [ ] No runtime errors
- [ ] Performance same or better

---

## 11. SUCCESS CRITERIA

**Frontend**:
- [ ] All 27 components tested (80%+ coverage)
- [ ] No prop drilling (data flows through context + hooks)
- [ ] Clear feature boundaries
- [ ] Easy to add new feature (add folder, no other changes)

**Backend**:
- [ ] All routers < 100 lines
- [ ] All services have single responsibility
- [ ] Engine modules testable without FastAPI
- [ ] Clear separation: Router → Service → Engine → Repository

**Integration**:
- [ ] App builds successfully
- [ ] All tests pass
- [ ] No circular dependencies
- [ ] Type consistency between frontend + backend

---

## 12. RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Large refactor breaks existing features | Feature flag critical paths; migrate one feature at a time |
| Performance degradation | Profile before/after; use React DevTools Profiler |
| Team friction on new patterns | Document patterns clearly; pair-program during transition |
| Type safety gaps | Add TypeScript or JSDoc; run type checking in CI/CD |
| Lost features during reorganization | Keep old code until new verified; test all critical flows |

---

## 13. NEXT ACTIONS

1. **Review this proposal** - Is the architecture aligned with vision?
2. **Approve structure** - Get stakeholder buy-in
3. **Create folder structure** (Phase 2.1) - No file moves yet
4. **Define types** (Phase 2.2) - Frontend + backend models
5. **Build engine layer** (Phase 2.3) - Pure logic modules
6. **Build service layer** (Phase 2.4) - Thick services
7. **Migrate features one by one** (Phase 2 onward)

---

## ARCHITECTURE PLAN STATUS: ✅ COMPLETE (PROPOSAL STAGE)

**Next**: User review → Approval → Implementation begins with Phase 2

