"""
fastapi/model_inference/emotion_model.py
==================================
KcELECTRA v8 감정 추론 서비스

model/kcelectra/ 폴더의 모델 파일을 로드해
6감정 점수(합=100, DECIMAL(4,1))를 반환한다.

파일 구성:
  [구간 1] import / 경로·상수 설정
  [구간 2] 초기화 — load_model(), is_loaded()
  [구간 3] 내부 인코딩 — _build_input()
  [구간 4] 퍼블릭 API — predict_emotions()
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════
# [구간 1] 경로 · 상수 설정
# ═══════════════════════════════════════════════
# model/kcelectra/ 안에 config.json, model.safetensors, tokenizer.json,
# tokenizer_config.json, temperature.json 5개 파일이 있어야 함.
_MODEL_DIR = Path(__file__).parent.parent / "model" / "kcelectra"

# 6감정 레이블. 학습 시 라벨 순서(EMOTION2ID)와 반드시 동일해야
# 모델 출력 인덱스와 한글 라벨이 올바르게 매핑된다.
# 의도적으로 emotions.py(공용 상수)를 import하지 않음
EMOTIONS: list[str] = ["기쁨", "슬픔", "불안", "분노", "상처", "당황"]

# 토큰 예산 — v8 학습 시 정한 고정값. 바꾸면 추론 정확도가 떨어진다.
#   이전발화 있음: [CLS](1) + prev(25) + [SEP](1) + curr(100) + [SEP](1) = 128
#   단독 발화    : [CLS](1) + curr(126) + [SEP](1)                       = 128
_MAX_LEN      = 128
_PREV_MAX_TOK = 25    # 이전 발화는 "문맥 참고용"이라 짧게 자름
_CURR_MAX_TOK = 100   # 현재 발화가 추론의 핵심이라 가장 길게 배정
_SOLO_MAX_TOK = 126   # 이전 발화가 없을 때(세션 첫 발화)는 현재 발화에 더 많은 토큰 배정

# 모듈 전역 싱글턴 — FastAPI 프로세스당 모델을 한 번만 메모리에 올려두기 위함.
# (요청마다 새로 로드하면 매번 수백 ms~수초가 낭비됨)
_tokenizer: AutoTokenizer | None                      = None
_model    : AutoModelForSequenceClassification | None = None
_T        : float                                     = 1.0   # Temperature 보정값
_device   : torch.device                              = torch.device("cpu")


# ═══════════════════════════════════════════════
# [구간 2] 초기화
# ═══════════════════════════════════════════════

def load_model() -> None:
    """
    FastAPI lifespan(startup)에서 1회만 호출.

    - GPU 있으면 자동으로 cuda 사용, 없으면 cpu로 폴백
    - temperature.json이 있으면 그 값을, 없으면 T=1.0(보정 없음)로 동작
    - 이미 로드돼 있으면(재호출) 아무 일도 하지 않고 즉시 반환 (idempotent)
    """
    global _tokenizer, _model, _T, _device

    if _model is not None:
        return  # 중복 호출 방지

    if not _MODEL_DIR.exists():
        raise FileNotFoundError(f"모델 디렉터리 없음: {_MODEL_DIR}")

    _device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _tokenizer = AutoTokenizer.from_pretrained(str(_MODEL_DIR))
    _model     = AutoModelForSequenceClassification.from_pretrained(
        str(_MODEL_DIR), num_labels=len(EMOTIONS)
    ).to(_device)
    _model.eval()   # 추론 전용 — dropout 등 비활성화

    temp_path = _MODEL_DIR / "temperature.json"
    if temp_path.exists():
        with open(temp_path, encoding="utf-8") as f:
            _T = float(json.load(f).get("temperature", 1.0))

    logger.info("emotion_model 로드 완료 | device=%s | T=%.4f", _device, _T)


def is_loaded() -> bool:
    """헬스체크용 — main.py의 /health 엔드포인트가 호출."""
    return _model is not None


# ═══════════════════════════════════════════════
# [구간 3] 내부 인코딩
# ═══════════════════════════════════════════════

def _build_input(text: str, prev_text: str | None) -> dict[str, torch.Tensor]:
    """
    토큰화 + [CLS]/[SEP] 조합 + 패딩.

    prev_text 유무에 따라 두 가지 형태로 분기:
      - 있음: [CLS] + 이전발화(≤25토큰) + [SEP] + 현재발화(≤100토큰) + [SEP]
      - 없음: [CLS] + 현재발화(≤126토큰) + [SEP]
    이후 항상 128 길이로 패딩(짧으면 PAD 채움, attention_mask로 구분).
    """
    assert _tokenizer is not None

    CLS = _tokenizer.cls_token_id
    SEP = _tokenizer.sep_token_id
    PAD = _tokenizer.pad_token_id

    if prev_text:
        prev_ids = _tokenizer.encode(prev_text, add_special_tokens=False)[:_PREV_MAX_TOK]
        curr_ids = _tokenizer.encode(text,      add_special_tokens=False)[:_CURR_MAX_TOK]
        all_ids  = [CLS] + prev_ids + [SEP] + curr_ids + [SEP]
    else:
        curr_ids = _tokenizer.encode(text, add_special_tokens=False)[:_SOLO_MAX_TOK]
        all_ids  = [CLS] + curr_ids + [SEP]

    all_ids = all_ids[:_MAX_LEN]          # 안전장치 — 어떤 경우에도 128 안 넘기기
    attn    = [1] * len(all_ids)
    pad_len = _MAX_LEN - len(all_ids)
    all_ids += [PAD] * pad_len
    attn    += [0]   * pad_len             # PAD 부분은 attention에서 제외

    return {
        "input_ids"     : torch.tensor([all_ids], dtype=torch.long),
        "attention_mask": torch.tensor([attn],    dtype=torch.long),
    }


# ═══════════════════════════════════════════════
# [구간 4] 퍼블릭 API
# ═══════════════════════════════════════════════

@torch.no_grad()
def predict_emotions(
    text: str,
    prev_text: str | None = None,
) -> dict[str, float]:
    """
    6감정 분포 점수 반환 (합=100, 소수 1자리).

    Args:
        text      : 현재 발화 (필수)
        prev_text : 이전 발화. 세션 첫 발화이거나 이전발화가 없으면 None.
                    (호출자가 직접 결정해서 넘겨준다 — 이 함수는 DB를 모름)

    Returns:
        {"기쁨": 2.2, "슬픔": 73.7, "불안": 4.5,
         "분노": 4.8, "상처": 9.7,  "당황": 5.4}

    Raises:
        RuntimeError: load_model()을 먼저 호출하지 않은 경우
    """
    if _model is None or _tokenizer is None:
        raise RuntimeError("load_model()을 먼저 호출하세요.")

    enc = {k: v.to(_device) for k, v in _build_input(text, prev_text).items()}

    # logits / T → softmax: Temperature 보정으로 모델 과신/과소신뢰를 교정
    probs = torch.softmax(
        _model(**enc).logits.float().cpu() / _T, dim=1
    ).numpy()[0] * 100

    return {EMOTIONS[i]: round(float(probs[i]), 1) for i in range(len(EMOTIONS))}
