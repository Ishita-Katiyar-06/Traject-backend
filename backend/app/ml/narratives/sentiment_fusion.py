import logging
from typing import Sequence

from app.ml.narratives.models import NarrativeSentimentProfile
from app.ml.sentiment.inference import SentimentModelAdapter
from app.ml.sentiment.models import SentimentLabel
from app.schemas import CanonicalMessage

logger = logging.getLogger("traject.ml.narratives.sentiment_fusion")

DEFAULT_SENTIMENT_MODEL_ID = "cardiffnlp/twitter-roberta-base-sentiment-latest"


def load_shared_sentiment_adapter(
    model_id: str | None = None,
    device: str | None = None,
) -> SentimentModelAdapter | None:
    """Load pretrained sentiment model adapter once for shared reuse across topic candidates.
    
    Returns:
        SentimentModelAdapter instance if successfully initialized, or None if unavailable.
    """
    target_id = model_id or DEFAULT_SENTIMENT_MODEL_ID
    try:
        adapter = SentimentModelAdapter(target_id, device=device)
        logger.info("Successfully loaded shared sentiment adapter '%s'", target_id)
        return adapter
    except Exception as err:
        logger.warning(
            "Could not load sentiment model adapter '%s' (%s). "
            "Proceeding with sentiment availability set to False.",
            target_id,
            err,
        )
        return None


def evaluate_cluster_sentiment(
    messages: Sequence[CanonicalMessage],
    adapter: SentimentModelAdapter | None,
    emoji_polarity_score: float = 0.0,
    batch_size: int = 16,
) -> NarrativeSentimentProfile:
    """Run batched sentiment inference across all text-bearing messages in candidate topic.
    
    Processing Policy:
    1. Evaluates all messages with non-empty text content in batches to prevent sample bias.
    2. If adapter is None or unavailable, sets is_available=False and returns None for all ratios.
       Never fabricates artificial neutrality when model inference is absent.
    3. Representative messages are preserved for qualitative excerpts, not distribution estimation.
    """
    text_msgs = [m for m in messages if m.text_content and len(m.text_content.strip()) > 0]

    if adapter is None or not text_msgs:
        return NarrativeSentimentProfile(
            is_available=False,
            total_text_messages_evaluated=0,
            text_positive_ratio=None,
            text_neutral_ratio=None,
            text_negative_ratio=None,
            emoji_polarity_score=emoji_polarity_score,
            sentiment_model_id=None,
        )

    try:
        texts = [m.text_content for m in text_msgs]
        predictions = adapter.predict_batch(texts, batch_size=batch_size)

        total = len(predictions)
        if total == 0:
            return NarrativeSentimentProfile(
                is_available=False,
                total_text_messages_evaluated=0,
                text_positive_ratio=None,
                text_neutral_ratio=None,
                text_negative_ratio=None,
                emoji_polarity_score=emoji_polarity_score,
                sentiment_model_id=adapter.model_id,
            )

        pos_count = sum(1 for p in predictions if p.label == SentimentLabel.POSITIVE)
        neu_count = sum(1 for p in predictions if p.label == SentimentLabel.NEUTRAL)
        neg_count = sum(1 for p in predictions if p.label == SentimentLabel.NEGATIVE)

        return NarrativeSentimentProfile(
            is_available=True,
            total_text_messages_evaluated=total,
            text_positive_ratio=round(pos_count / total, 4),
            text_neutral_ratio=round(neu_count / total, 4),
            text_negative_ratio=round(neg_count / total, 4),
            emoji_polarity_score=emoji_polarity_score,
            sentiment_model_id=adapter.model_id,
        )

    except Exception as err:
        logger.warning(
            "Batch sentiment inference failed (%s); marking sentiment unavailable.",
            err,
        )
        return NarrativeSentimentProfile(
            is_available=False,
            total_text_messages_evaluated=0,
            text_positive_ratio=None,
            text_neutral_ratio=None,
            text_negative_ratio=None,
            emoji_polarity_score=emoji_polarity_score,
            sentiment_model_id=adapter.model_id,
        )
