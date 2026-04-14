from __future__ import annotations

from typing import Any

import pandas as pd

from .model_service import get_model
from .schema import COLUMN_ALIASES, FEATURE_COLUMNS


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    return df.rename(columns=COLUMN_ALIASES).copy()


def validate_and_prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    normalized = normalize_columns(df)

    missing = [col for col in FEATURE_COLUMNS if col not in normalized.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    prepared = normalized[FEATURE_COLUMNS].copy()

    for col in FEATURE_COLUMNS:
        prepared[col] = pd.to_numeric(prepared[col], errors="coerce")

    bad_cols = [col for col in FEATURE_COLUMNS if prepared[col].isna().any()]
    if bad_cols:
        raise ValueError(f"Invalid or non-numeric values found in columns: {bad_cols}")

    return prepared


def predict_from_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    model = get_model()
    X = validate_and_prepare_dataframe(df)

    predictions = model.predict(X).tolist()

    probabilities = None
    classes = None
    max_confidence = None

    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)
        probabilities = proba.tolist()
        max_confidence = proba.max(axis=1).tolist()
        if hasattr(model, "classes_"):
            classes = model.classes_.tolist()

    results = []
    for i, pred in enumerate(predictions):
        item = {
            "row_index": int(i),
            "prediction": pred,
        }
        if max_confidence is not None:
            item["confidence"] = float(max_confidence[i])
        if probabilities is not None and classes is not None:
            item["probabilities"] = {
                cls: float(probabilities[i][j]) for j, cls in enumerate(classes)
            }
        results.append(item)

    summary: dict[str, int] = {}
    for pred in predictions:
        summary[pred] = summary.get(pred, 0) + 1

    return {
        "ok": True,
        "input_rows": int(len(X)),
        "required_features": FEATURE_COLUMNS,
        "summary": summary,
        "results": results,
    }


def predict_from_csv_file(file_storage) -> dict[str, Any]:
    df = pd.read_csv(file_storage)
    return predict_from_dataframe(df)