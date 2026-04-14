from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import joblib

from .config import ACTIVE_MODEL_PATH, DEFAULT_MODEL_PATH


_MODEL: Any | None = None
_MODEL_PATH_LOADED: Path | None = None


def ensure_active_model() -> Path:
    if not ACTIVE_MODEL_PATH.exists():
        if not DEFAULT_MODEL_PATH.exists():
            raise FileNotFoundError(f"Default model not found: {DEFAULT_MODEL_PATH}")
        ACTIVE_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DEFAULT_MODEL_PATH, ACTIVE_MODEL_PATH)
    return ACTIVE_MODEL_PATH


def get_model():
    global _MODEL, _MODEL_PATH_LOADED

    model_path = ensure_active_model()

    if _MODEL is None or _MODEL_PATH_LOADED != model_path:
        _MODEL = joblib.load(model_path)
        _MODEL_PATH_LOADED = model_path

    return _MODEL


def get_active_model_path() -> str:
    return str(ensure_active_model())


def activate_model(model_path: str | Path) -> str:
    global _MODEL, _MODEL_PATH_LOADED

    src = Path(model_path)
    if not src.exists():
        raise FileNotFoundError(f"Model file not found: {src}")

    ACTIVE_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, ACTIVE_MODEL_PATH)

    _MODEL = None
    _MODEL_PATH_LOADED = None

    return str(ACTIVE_MODEL_PATH)