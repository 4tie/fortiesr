"""app_services.py contains backend logic for app services.

This file is intentionally documented in plain English so readers can follow
what each section does even without deep Python experience.
"""

from __future__ import annotations
from pathlib import Path

from .core.errors import BackendError
from .models import RunDetail, RunListItem, RunStatusPayload, StrategyDetail
from .paths import build_local_paths
from .services.execution.backtest_runner import BacktestRunner
from .services.strategy.comparison import ComparisonEngine
from .services.execution.data_download_runner import DataDownloadRunner
from .services.maintenance.maintenance import MaintenanceService
from .services.execution.pair_sweep_runner import PairSweepRunner
from .services.storage.pair_sweep_store import PairSweepStore
from .services.storage.exported_trial_store import ExportedTrialStore
from .services.storage.optimizer_store import OptimizerStore
from .services.strategy.strategy_optimizer import StrategyOptimizerService
from .services.storage.result_parser import ResultParser
from .services.execution.run_progress import RunProgressService
from .services.storage.run_repository import RunRepository
from .services.strategy.strategy_git import StrategyGitService
from .services.strategy.strategy_registry import StrategyRegistry
from .services.strategy.strategy_source import StrategySourceParser
from .services.strategy.version_manager import VersionManager
from .services.strategy.snapshot_service import SnapshotService
from .services.pairs.pair_selector import PairSelectorService
from .models import SaveSettingsRequest
from .settings_store import SettingsStore
from .utils import read_json


class AppServices:
    """AppServices contains class-level backend logic."""
    def __init__(self, root_dir: Path) -> None:
        """__init__ implements function-level backend logic."""
        self.root_dir = root_dir
        self.settings_store = SettingsStore(root_dir)
        self.reload()
        self.progress_service.recover_orphaned_runs()
        self.pair_sweep_runner.recover_interrupted_sessions()

    def reload(self) -> None:
        """reload implements function-level backend logic."""
        self.settings = self.settings_store.load()
        self.paths = build_local_paths(self.root_dir, self.settings)
        self.strategy_parser = StrategySourceParser(self.paths.strategies_dir, self.paths.versions_root)
        self.registry = StrategyRegistry(self.paths.strategies_dir, self.paths.versions_root)
        self.version_manager = VersionManager(self.paths.versions_root, self.strategy_parser)
        self.snapshot_service = SnapshotService(self.paths.backups_root)
        self.run_repository = RunRepository(self.paths.backtest_results_root)
        self.progress_service = RunProgressService(self.run_repository)
        self.result_parser = ResultParser()
        self.comparison_engine = ComparisonEngine()
        self.strategy_git_service = StrategyGitService(self.paths.versions_root)
        self.data_download_runner = DataDownloadRunner(
            self.settings_store,
            self.paths.data_downloads_root,
        )
        self.backtest_runner = BacktestRunner(
            self.settings_store,
            self.run_repository,
            self.progress_service,
            self.version_manager,
            self.result_parser,
            self.strategy_git_service,
            self.data_download_runner,
        )
        self.pair_selector = PairSelectorService(self.paths.pair_selector_data_dir)
        self.sweep_store = PairSweepStore(self.paths.sweep_root)
        self.pair_sweep_runner = PairSweepRunner(
            sweep_store=self.sweep_store,
            backtest_runner=self.backtest_runner,
            run_repository=self.run_repository,
            registry=self.registry,
            settings_store=self.settings_store,
            version_manager=self.version_manager,
            pair_selector=self.pair_selector,
            data_download_runner=self.data_download_runner,
        )
        self.maintenance_service = MaintenanceService(
            root_dir=self.root_dir,
            user_data_dir=Path(self.settings.user_data_directory_path),
            app_log_file=self.paths.app_log_file,
            data_downloads_root=self.paths.data_downloads_root,
        )
        self.optimizer_store = OptimizerStore(self.paths.optimizer_root)
        self.exported_trial_store = ExportedTrialStore(
            Path(self.settings.user_data_directory_path) / "exported_optimizer_runs.json"
        )
        self.strategy_optimizer = StrategyOptimizerService(
            optimizer_store=self.optimizer_store,
            backtest_runner=self.backtest_runner,
            run_repository=self.run_repository,
            registry=self.registry,
            settings_store=self.settings_store,
            version_manager=self.version_manager,
            source_parser=self.strategy_parser,
        )
        self.registry.scan()

    def save_settings(self, request: SaveSettingsRequest) -> None:
        """save_settings implements function-level backend logic."""
        self.settings_store.save(request)
        self.reload()

    def strategy_detail(self, strategy_name: str) -> StrategyDetail:
        """strategy_detail implements function-level backend logic."""
        strategy = self.registry.get_strategy(strategy_name)
        versions = self.version_manager.list_versions(strategy_name)
        pointer = self.version_manager.get_current_pointer(strategy_name)
        return StrategyDetail(strategy=strategy, versions=versions, current_accepted=pointer)

    def list_runs(self, strategy_name: str | None = None) -> list[RunListItem]:
        """list_runs implements function-level backend logic."""
        items: list[RunListItem] = []
        for metadata in self.run_repository.list_runs(strategy_name):
            run_dir = self.run_repository.find_run_dir(metadata.run_id)
            progress = self.progress_service.load_progress(run_dir, metadata)
            items.append(RunListItem(**metadata.model_dump(mode="json"), progress=progress))
        return items

    def run_detail(self, run_id: str) -> RunDetail:
        """run_detail implements function-level backend logic."""
        detail = self.run_repository.load_detail(run_id)
        run_dir = self.run_repository.find_run_dir(run_id)
        progress = self.progress_service.load_progress(run_dir, detail.metadata)
        return detail.model_copy(update={"progress": progress})

    def run_status(self, run_id: str) -> RunStatusPayload:
        """run_status implements function-level backend logic."""
        metadata = self.run_repository.load_metadata(run_id)
        run_dir = self.run_repository.find_run_dir(run_id)
        progress = self.progress_service.load_progress(run_dir, metadata)
        return RunStatusPayload(run_id=run_id, run_status=metadata.run_status, progress=progress)

    def compare_runs(self, baseline_run_id: str, candidate_run_id: str):
        """compare_runs implements function-level backend logic."""
        baseline = self.run_repository.load_detail(baseline_run_id)
        candidate = self.run_repository.load_detail(candidate_run_id)
        if baseline.parsed_summary is None or candidate.parsed_summary is None:
            raise BackendError("Both runs must have parsed summaries before comparison.", status_code=409)
        baseline_params = read_json(self.run_repository.find_run_dir(baseline_run_id) / "strategy_params.json", default={})
        candidate_params = read_json(self.run_repository.find_run_dir(candidate_run_id) / "strategy_params.json", default={})
        return self.comparison_engine.compare(
            baseline.metadata,
            candidate.metadata,
            baseline.parsed_summary.model_dump(mode="json"),
            candidate.parsed_summary.model_dump(mode="json"),
            [item.model_dump(mode="json") for item in baseline.pair_results],
            [item.model_dump(mode="json") for item in candidate.pair_results],
            baseline_params,
            candidate_params,
        )
