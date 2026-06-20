"""settings_store.py contains backend logic for settings store."""

from __future__ import annotations
import shutil
from pathlib import Path

from .core.errors import BackendError
from .models import SaveSettingsRequest, SettingsModel
from .utils import atomic_write_json, ensure_directory, read_json


class SettingsStore:
    """SettingsStore contains class-level backend logic."""
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir
        self.settings_file = root_dir / "user_data" / "strategy_lab_settings.json"

    def defaults(self) -> SettingsModel:
        preferred_freqtrade = self.root_dir / ".venv" / "bin" / "freqtrade"
        return SettingsModel(
            freqtrade_executable_path=(
                str(preferred_freqtrade) if preferred_freqtrade.exists() else "freqtrade"
            ),
            strategies_directory_path=str(self.root_dir / "user_data" / "strategies"),
            user_data_directory_path=str(self.root_dir / "user_data"),
            default_config_file_path=str(self.root_dir / "user_data" / "config.json"),
            ollama_api_url="http://localhost:11434",
            ollama_model="",
            network_mode="local",
            hyperopt_workers=2,
            ollama_self_healing_enabled=False,
            ollama_timeout=30,
        )

    def load(self) -> SettingsModel:
        raw = read_json(self.settings_file)
        if raw is None:
            defaults = self.defaults()
            atomic_write_json(self.settings_file, defaults.model_dump(mode="json"))
            return defaults
        return SettingsModel.model_validate(raw)

    def save(self, request: SaveSettingsRequest | SettingsModel) -> SettingsModel:
        settings = SettingsModel.model_validate(request)
        self._validate(settings)
        atomic_write_json(self.settings_file, settings.model_dump(mode="json"))
        return settings

    def _validate(self, settings: SettingsModel) -> None:
        if shutil.which(settings.freqtrade_executable_path) is None and not Path(
            settings.freqtrade_executable_path
        ).is_file():
            raise BackendError(
                "Invalid freqtrade_executable_path: executable was not found.",
                status_code=400,
            )

        for field_name, raw_path in [
            ("strategies_directory_path", settings.strategies_directory_path),
            ("user_data_directory_path", settings.user_data_directory_path),
        ]:
            path = Path(raw_path)
            if not path.exists() or not path.is_dir():
                raise BackendError(f"Invalid {field_name}: directory does not exist.", status_code=400)

        config_path = Path(settings.default_config_file_path)
        if not config_path.exists() or not config_path.is_file():
            raise BackendError(
                "Invalid default_config_file_path: file does not exist.",
                status_code=400,
            )
