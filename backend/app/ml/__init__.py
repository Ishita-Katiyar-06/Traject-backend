from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.ml.dataset import (
        LanguageAwareMLTextRecord,
        MLTextRecord,
        load_canonical_dataset,
        prepare_language_aware_records,
        prepare_ml_text_records,
    )
    from app.ml.inspection import (
        MLDatasetInspection,
        NumericDistribution,
        inspect_canonical_dataset,
    )
    from app.ml.language import (
        LanguageDetectionResult,
        MLLanguageInspection,
        identify_language,
        inspect_canonical_languages,
    )
    from app.ml.normalization import normalize_social_text


def __getattr__(name: str):
    import app.ml.dataset as d
    if hasattr(d, name):
        return getattr(d, name)
    import app.ml.inspection as i
    if hasattr(i, name):
        return getattr(i, name)
    import app.ml.language as l
    if hasattr(l, name):
        return getattr(l, name)
    import app.ml.normalization as n
    if hasattr(n, name):
        return getattr(n, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "MLTextRecord",
    "LanguageAwareMLTextRecord",
    "load_canonical_dataset",
    "prepare_ml_text_records",
    "prepare_language_aware_records",
    "NumericDistribution",
    "MLDatasetInspection",
    "inspect_canonical_dataset",
    "LanguageDetectionResult",
    "MLLanguageInspection",
    "identify_language",
    "inspect_canonical_languages",
    "normalize_social_text",
]
