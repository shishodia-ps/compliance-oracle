"""Language detection utilities."""

import re
from typing import Optional, Dict
from langdetect import detect, DetectorFactory, LangDetectException

# Set seed for consistent results
DetectorFactory.seed = 0


# Language-specific patterns for enhanced detection
LANGUAGE_PATTERNS = {
    "de": [
        r'\b(der|die|das|und|oder|aber|mit|von|für|auf|über|bei|durch)\b',
        r'\b(Artikel|Absatz|Nummer|Gesetz|Verordnung|Richtlinie)\b',
        r'\b(Geldwäsche|Sorgfaltspflichten|Kundenidentifizierung)\b',
    ],
    "fr": [
        r'\b(le|la|les|un|une|des|et|ou|mais|avec|pour|dans|sur)\b',
        r'\b(article|alinéa|paragraphe|loi|règlement|directive)\b',
        r'\b(blanchiment|vigilance|identification)\b',
    ],
    "nl": [
        r'\b(de|het|een|en|of|maar|met|voor|in|op|bij|door)\b',
        r'\b(artikel|lid|nummer|wet|verordening|richtlijn)\b',
        r'\b(witwassen|zorgplicht|identificatie)\b',
    ],
    "en": [
        r'\b(the|a|an|and|or|but|with|for|in|on|at|by|from)\b',
        r'\b(article|section|paragraph|law|regulation|directive)\b',
        r'\b(laundering|diligence|identification)\b',
    ],
}


def detect_language(text: str, default: str = "en") -> str:
    """Detect the language of a text.

    Args:
        text: Text to analyze
        default: Default language if detection fails

    Returns:
        ISO 639-1 language code
    """
    if not text or len(text.strip()) < 50:
        return default

    # Take a sample for detection (first 2000 chars)
    sample = text[:2000]

    try:
        # Use langdetect library
        detected = detect(sample)

        # Validate against supported languages
        supported = ["en", "de", "fr", "nl", "lu", "it", "es", "pt"]
        if detected in supported:
            return detected

        # If detected language is not supported, use pattern matching
        return _detect_by_patterns(sample, default)

    except LangDetectException:
        # Fallback to pattern matching
        return _detect_by_patterns(sample, default)


def _detect_by_patterns(text: str, default: str = "en") -> str:
    """Detect language using regex patterns.

    Args:
        text: Text to analyze
        default: Default language if no match

    Returns:
        Language code
    """
    text_lower = text.lower()
    scores: Dict[str, int] = {}

    for lang, patterns in LANGUAGE_PATTERNS.items():
        score = 0
        for pattern in patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            score += len(matches)
        scores[lang] = score

    # Return language with highest score
    if scores:
        max_lang = max(scores, key=scores.get)
        if scores[max_lang] > 5:  # Minimum threshold
            return max_lang

    return default


def detect_mixed_languages(text: str) -> Dict[str, float]:
    """Detect if document contains multiple languages.

    Args:
        text: Text to analyze

    Returns:
        Dictionary of language codes and their estimated proportions
    """
    # Split text into chunks
    chunk_size = 1000
    chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

    language_counts: Dict[str, int] = {}

    for chunk in chunks:
        if len(chunk.strip()) < 50:
            continue

        try:
            lang = detect(chunk)
            language_counts[lang] = language_counts.get(lang, 0) + 1
        except LangDetectException:
            continue

    # Calculate proportions
    total = sum(language_counts.values())
    if total == 0:
        return {"en": 1.0}

    proportions = {lang: count / total for lang, count in language_counts.items()}

    return proportions


def is_legal_document(text: str, language: str = "en") -> bool:
    """Detect if text appears to be a legal/regulatory document.

    Args:
        text: Text to analyze
        language: Language code

    Returns:
        True if document appears to be legal/regulatory
    """
    legal_patterns = {
        "en": [
            r'\b(article|section|paragraph|subsection|clause)\s+\d+',
            r'\b(shall|must|required|obligated|mandatory)\b',
            r'\b(regulation|directive|statute|ordinance|act)\b',
            r'\b(pursuant to|in accordance with|subject to)\b',
        ],
        "de": [
            r'\b(Artikel|Absatz|Nummer)\s+\d+',
            r'\b(muss|soll|sind\s+verpflichtet)\b',
            r'\b(Verordnung|Richtlinie|Gesetz)\b',
            r'\b(gemäß|nach|laut)\b',
        ],
        "fr": [
            r'\b(article|alinéa|paragraphe)\s+\d+',
            r'\b(doit|doivent|est\s+tenu|sont\s+tenus)\b',
            r'\b(règlement|directive|loi)\b',
            r'\b(conformément|selon|aux\s+termes)\b',
        ],
        "nl": [
            r'\b(artikel|lid|nummer)\s+\d+',
            r'\b(moet|moeten|verplicht)\b',
            r'\b(verordening|richtlijn|wet)\b',
            r'\b(overeenkomstig|volgens|krachtens)\b',
        ],
    }

    patterns = legal_patterns.get(language, legal_patterns["en"])

    text_sample = text[:5000].lower()
    match_count = 0

    for pattern in patterns:
        matches = re.findall(pattern, text_sample, re.IGNORECASE)
        match_count += len(matches)

    # If we find at least 5 legal patterns, likely a legal document
    return match_count >= 5


def get_language_name(code: str) -> str:
    """Get full language name from code.

    Args:
        code: ISO 639-1 language code

    Returns:
        Full language name
    """
    language_names = {
        "en": "English",
        "de": "German",
        "fr": "French",
        "nl": "Dutch",
        "lu": "Luxembourgish",
        "it": "Italian",
        "es": "Spanish",
        "pt": "Portuguese",
    }

    return language_names.get(code, code.upper())
