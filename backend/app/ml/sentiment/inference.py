import logging
from typing import Any, Sequence

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from app.ml.sentiment.models import SentimentLabel, SentimentPrediction

logger = logging.getLogger("traject.ml.sentiment.inference")


def normalize_sentiment_label(raw_label: Any, fallback_idx: int | None = None) -> SentimentLabel:
    """Deterministically normalize arbitrary model label schemes into standard SentimentLabel categories.
    
    Supports:
    - Standard names: 'negative', 'neutral', 'positive' (case-insensitive)
    - Abbreviations: 'neg', 'neu', 'pos'
    - Hugging Face default generic tags: 'LABEL_0' (neg), 'LABEL_1' (neu), 'LABEL_2' (pos)
    - Numeric index fallbacks: 0 -> negative, 1 -> neutral, 2 -> positive
    """
    if isinstance(raw_label, int):
        if raw_label == 0:
            return SentimentLabel.NEGATIVE
        elif raw_label == 1:
            return SentimentLabel.NEUTRAL
        elif raw_label == 2:
            return SentimentLabel.POSITIVE

    s = str(raw_label).lower().strip()
    if "neg" in s or s in ("0", "label_0"):
        return SentimentLabel.NEGATIVE
    elif "pos" in s or s in ("2", "label_2"):
        return SentimentLabel.POSITIVE
    elif "neu" in s or s in ("1", "label_1"):
        return SentimentLabel.NEUTRAL

    if fallback_idx is not None:
        return normalize_sentiment_label(fallback_idx)

    logger.warning("Unrecognized raw sentiment label '%s'; defaulting to neutral", raw_label)
    return SentimentLabel.NEUTRAL


class SentimentModelAdapter:
    """Clean, reusable inference adapter for pretrained sequence-classification sentiment models."""

    def __init__(
        self,
        model_id: str,
        device: str | None = None,
        max_length: int = 512,
    ) -> None:
        """Initialize the model adapter with evaluation mode and normalized label mappings.
        
        Args:
            model_id: Hugging Face model repository identifier or local path.
            device: 'cpu', 'cuda', or None for automatic device detection.
            max_length: Maximum sequence length for truncation.
        """
        self.model_id = model_id
        self.max_length = max_length

        if device is None:
            self.device_name = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device_name = device

        self.device = torch.device(self.device_name)
        logger.info("Loading model '%s' on device '%s'...", model_id, self.device_name)

        import os
        from pathlib import Path
        token = os.environ.get("HF_TOKEN")

        # Resolve local directory if stored locally
        load_path = model_id
        is_local = False
        if Path(model_id).is_dir():
            load_path = str(Path(model_id).resolve())
            is_local = True
        else:
            # Check models/ directory relative to workspace root or any parent
            for parent in Path(__file__).resolve().parents:
                candidate = parent / "models" / model_id
                if candidate.is_dir():
                    load_path = str(candidate.resolve())
                    is_local = True
                    break

        # Determine safetensors preference
        use_safetensors = True
        if Path(load_path).is_dir():
            has_bin = (Path(load_path) / "pytorch_model.bin").is_file()
            has_safetensors = (Path(load_path) / "model.safetensors").is_file()
            if has_bin and not has_safetensors:
                use_safetensors = False

        self.tokenizer = AutoTokenizer.from_pretrained(
            load_path,
            token=token,
            local_files_only=is_local,
        )
        self.model = AutoModelForSequenceClassification.from_pretrained(
            load_path,
            token=token,
            use_safetensors=use_safetensors,
            local_files_only=is_local,
        )
        self.model.to(self.device)
        self.model.eval()



        # Build normalized index-to-label mapping
        id2label = getattr(self.model.config, "id2label", {})
        num_labels = getattr(self.model.config, "num_labels", 3)
        self.idx_to_label: dict[int, SentimentLabel] = {}

        for idx in range(num_labels):
            raw = id2label.get(idx, id2label.get(str(idx), idx))
            self.idx_to_label[idx] = normalize_sentiment_label(raw, fallback_idx=idx)

        logger.debug("Configured label mapping for %s: %s", model_id, self.idx_to_label)

    def predict_batch(
        self,
        texts: Sequence[str],
        batch_size: int = 16,
    ) -> list[SentimentPrediction]:
        """Perform deterministic, batched sentiment inference without gradient computation.
        
        Args:
            texts: Sequence of social-media text strings.
            batch_size: Mini-batch size for processing.
            
        Returns:
            list[SentimentPrediction]: Ordered predictions matching input sequence.
        """
        predictions: list[SentimentPrediction] = []
        text_list = list(texts)

        if not text_list:
            return predictions

        for i in range(0, len(text_list), batch_size):
            batch_texts = text_list[i : i + batch_size]

            with torch.no_grad():
                inputs = self.tokenizer(
                    batch_texts,
                    return_tensors="pt",
                    padding=True,
                    truncation=True,
                    max_length=self.max_length,
                )
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
                outputs = self.model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1).cpu()

            for row_idx in range(len(batch_texts)):
                row_probs = probs[row_idx]
                scores: dict[str, float] = {}

                for class_idx, label_enum in self.idx_to_label.items():
                    val = float(row_probs[class_idx]) if class_idx < len(row_probs) else 0.0
                    scores[label_enum.value] = round(val, 4)

                # Ensure all 3 categories are represented in scores
                for standard_label in SentimentLabel:
                    if standard_label.value not in scores:
                        scores[standard_label.value] = 0.0

                top_idx = int(torch.argmax(row_probs).item())
                top_label = self.idx_to_label.get(top_idx, SentimentLabel.NEUTRAL)
                top_conf = round(float(row_probs[top_idx].item()), 4)

                predictions.append(
                    SentimentPrediction(
                        label=top_label,
                        confidence=top_conf,
                        scores=scores,
                        model_id=self.model_id,
                    )
                )

        return predictions


# Common reusable hierarchy
SentimentModel = SentimentModelAdapter


class EnglishSentimentModel(SentimentModel):
    """Specialized English social-media sentiment model."""
    DEFAULT_MODEL_ID = "cardiffnlp/twitter-roberta-base-sentiment-latest"

    def __init__(
        self,
        model_id: str | None = None,
        device: str | None = None,
        max_length: int = 512,
    ) -> None:
        super().__init__(
            model_id=model_id or self.DEFAULT_MODEL_ID,
            device=device,
            max_length=max_length,
        )


class MultilingualSentimentModel(SentimentModel):
    """Specialized Multilingual social-media sentiment model."""
    DEFAULT_MODEL_ID = "cardiffnlp/twitter-xlm-roberta-base-sentiment"

    def __init__(
        self,
        model_id: str | None = None,
        device: str | None = None,
        max_length: int = 512,
    ) -> None:
        super().__init__(
            model_id=model_id or self.DEFAULT_MODEL_ID,
            device=device,
            max_length=max_length,
        )

