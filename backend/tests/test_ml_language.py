import pytest

from app.ml.language import (
    DEFAULT_CONFIDENCE_THRESHOLD,
    LanguageDetectionResult,
    identify_language,
)


def test_empty_text_produces_unknown():
    """1. Test that empty or whitespace-only text safely produces unknown."""
    res_empty = identify_language("")
    assert res_empty.language == "unknown"
    assert res_empty.confidence == 0.0

    res_spaces = identify_language("     ")
    assert res_spaces.language == "unknown"
    assert res_spaces.confidence == 0.0


def test_short_text_produces_unknown():
    """2. Test that text shorter than min_text_length (10 chars) defaults to unknown."""
    res = identify_language("Hello!", min_text_length=10)
    assert res.language == "unknown"
    assert res.confidence == 0.0


def test_english_language_detection():
    """3. Test unambiguous English sentence is identified as 'en' with high confidence."""
    text = "This is a comprehensive intelligence analysis report regarding social media narratives."
    res = identify_language(text)
    assert res.language == "en"
    assert res.confidence >= 0.90
    assert "langdetect" in res.detector


def test_hindi_language_detection():
    """4. Test unambiguous Hindi sentence is identified as 'hi' with high confidence."""
    text = "यह राष्ट्रीय तकनीकी अनुसंधान संगठन के लिए विकसित किया जा रहा सोशल मीडिया एनालिटिक्स प्लेटफॉर्म है।"
    res = identify_language(text)
    assert res.language == "hi"
    assert res.confidence >= 0.90


def test_russian_language_detection():
    """5. Test unambiguous Russian sentence is identified as 'ru' with high confidence."""
    text = "Это оперативная сводка новостей и обновлений из официального телеграм канала."
    res = identify_language(text)
    assert res.language == "ru"
    assert res.confidence >= 0.90


def test_detection_determinism():
    """6. Test that running language identification multiple times yields identical results."""
    text = "Deterministic execution is essential for verifiable analytics and machine learning pipelines."
    res1 = identify_language(text)
    res2 = identify_language(text)
    assert res1.language == res2.language
    assert res1.confidence == res2.confidence
    assert res1.detector == res2.detector


def test_low_confidence_fallback():
    """7. Test that predictions below the confidence threshold fall back to unknown."""
    # Ambiguous phrase where top language (af: 0.57) falls below 0.70 threshold
    text = "der die das"
    res = identify_language(text, confidence_threshold=0.70)
    assert res.language == "unknown"
    assert 0.0 < res.confidence < 0.70




def test_symbol_only_text_handles_gracefully():
    """8. Test that text containing only symbols or punctuation produces unknown without crashing."""
    text = "1234567890 !@#$%^&*()_+=-"
    res = identify_language(text)
    assert res.language == "unknown"
    assert res.confidence == 0.0
