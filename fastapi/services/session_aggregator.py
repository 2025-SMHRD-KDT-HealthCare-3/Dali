"""
fastapi/services/session_aggregator.py
========================================
Dali — 세션(대화) 단위 감정 점수 집계

phase3_session_validation.ipynb 에서 도출한
"정규화된 턴 위치별 가중치"를 그대로 적용한다.

파일 구성:
  [구간 1] 가중치 테이블 — 실측 데이터로 도출된 값 (가정값 없음)
  [구간 2] aggregate_session() — 보간 + 가중합 + 재정규화
  [구간 3] 단독 실행 테스트

⚠️ POSITION_WEIGHTS 교체 방법 (모델/데이터 갱신 시):
  1) Colab에서 phase3_session_validation.ipynb 끝까지 실행
  2) 생성된 phase3_final_recommendation.json 열기
  3) "weights" 안의 11개 값을 아래 POSITION_WEIGHTS 리스트에
     순서대로(0% → 100%) 그대로 붙여넣기
"""

from __future__ import annotations

import numpy as np

EMOTIONS = ["기쁨", "슬픔", "불안", "분노", "상처", "당황"]


# ═══════════════════════════════════════════════
# [구간 1] 가중치 테이블
# ═══════════════════════════════════════════════
# 0%, 10%, 20%, ..., 100% — 세션 내 발화의 "상대적 위치"별 가중치.
# AI-Hub 공감형 대화 25,456개 세션을 v8로 실제 추론해서 도출한 실측값.
# (가정값 아님 — baseline 단순평균 0.9510 → 가중치 적용 0.9765로
#  세션 라벨 복원 정확도가 개선됨을 검증함, 오류율 52% 감소)
#
# 초반(0~20%)일수록 가중치가 크고 후반(100%)일수록 작은 이유:
#   AI-Hub 공감형 대화는 "상담봇이 위로해서 감정을 풀어주는" 설계라서,
#   부정감정 세션의 88.8% 지점 근처에서 거의 항상 감정이 중립으로 전환됨
#   (25,456개 세션 중 부정감정 5종은 99.96~100% 전환 발생 확인됨).
#   따라서 후반부 발화는 "원래 감정"보다 "위로받은 결과"를 반영하므로
#   비중을 낮춰야 세션의 실제 감정을 더 정확히 포착함.
POSITION_WEIGHTS = np.array([
    0.1132,  # 0%    발화 시작 지점 — 감정이 가장 또렷
    0.1192,  # 10%   ← 전체 중 가장 큰 가중치
    0.1181,  # 20%
    0.1115,  # 30%
    0.0988,  # 40%   중반부터 위로 효과로 서서히 하락 시작
    0.0996,  # 50%
    0.0879,  # 60%
    0.0807,  # 70%
    0.0695,  # 80%
    0.0558,  # 90%
    0.0456,  # 100%  ← 가장 작은 가중치, 위로 효과로 신호 가장 희석된 지점
])
# 배포 전 안전장치 — 가중치 합이 1이 아니면(=값을 잘못 붙여넣었으면) 즉시 에러로 막음
assert abs(POSITION_WEIGHTS.sum() - 1.0) < 1e-3, "POSITION_WEIGHTS 합이 1이 아닙니다. 교체 필요."

# 위 11개 가중치에 대응하는 0.0~1.0 정규화 위치 (보간의 x축 기준점)
BIN_POSITIONS = np.linspace(0, 1, len(POSITION_WEIGHTS))


# ═══════════════════════════════════════════════
# [구간 2] 세션 집계 함수
# ═══════════════════════════════════════════════

def aggregate_session(utterance_scores: list[dict]) -> dict:
    """
    세션 내 발화별 6감정 점수 리스트를 받아 하나의 세션 점수로 집계.

    동작 원리:
      1) 턴 수(n)에 무관하게 각 발화 위치를 0~1로 정규화
         (예: 5턴이면 0, 0.25, 0.5, 0.75, 1.0)
      2) 고정된 11개 기준점(BIN_POSITIONS)·가중치(POSITION_WEIGHTS)를
         실제 턴 위치에 보간(np.interp)해서 적용
      3) 보간 후 가중치 합이 정확히 1이 아닐 수 있으므로 세션별 재정규화
      4) 가중합 → ReLU(음수 제거) → 합=100 재정규화

    Args:
        utterance_scores: 시간순으로 정렬된 발화별 점수 딕셔너리 리스트
            예) [{"기쁨":2.0,"슬픔":73.7,...}, {"기쁨":3.1,"슬픔":60.2,...}, ...]
            (emotion_model.predict_emotions() + intensity_scaler 적용 후
             결과를 호출자가 순서대로 누적해서 넘겨준다)

    Returns:
        세션 전체에 대한 6감정 점수 딕셔너리 (합=100)

    Raises:
        ValueError: utterance_scores가 빈 리스트일 때
    """
    if not utterance_scores:
        raise ValueError("utterance_scores가 비어 있습니다.")

    n = len(utterance_scores)
    scores = np.array([[u[e] for e in EMOTIONS] for u in utterance_scores])  # (n, 6)

    if n == 1:
        # 발화가 1개뿐이면 가중치를 적용할 의미가 없음 — 그대로 사용
        final = scores[0]
    else:
        turn_positions = np.array([i / (n - 1) for i in range(n)])         # 0~1 정규화
        w = np.interp(turn_positions, BIN_POSITIONS, POSITION_WEIGHTS)      # 보간
        w = w / w.sum()                                                     # 세션별 재정규화
        final = (scores * w[:, None]).sum(axis=0)                           # 가중합

    final = np.maximum(final, 0)            # 음수 방지 (보정 과정에서 드물게 발생 가능)
    final = final / final.sum() * 100       # 합=100으로 최종 정규화

    return {EMOTIONS[i]: round(float(final[i]), 1) for i in range(len(EMOTIONS))}


# ═══════════════════════════════════════════════
# [구간 3] 단독 실행 테스트
# ═══════════════════════════════════════════════
if __name__ == "__main__":
    # 가상 세션 (5턴) — 후반부로 갈수록 슬픔이 완화되는 패턴 (위로 효과 흉내)
    dummy_session = [
        {"기쁨": 5.0, "슬픔": 55.0, "불안": 10.0, "분노": 5.0, "상처": 20.0, "당황": 5.0},
        {"기쁨": 3.0, "슬픔": 20.0, "불안": 8.0,  "분노": 15.0, "상처": 48.0, "당황": 6.0},
        {"기쁨": 2.0, "슬픔": 25.0, "불안": 10.0, "분노": 12.0, "상처": 45.0, "당황": 6.0},
        {"기쁨": 3.0, "슬픔": 60.0, "불안": 12.0, "분노": 5.0,  "상처": 15.0, "당황": 5.0},
        {"기쁨": 30.0,"슬픔": 30.0, "불안": 10.0, "분노": 6.0,  "상처": 10.0, "당황": 4.0},  # 마지막 턴, 위로 효과 적용된 상태
    ]

    result = aggregate_session(dummy_session)
    print("세션 집계 결과:")
    for e, v in result.items():
        bar = "█" * int(v / 3)
        print(f"  {e:4s}: {v:5.1f}  {bar}")
    print(f"\n합계: {sum(result.values()):.2f}")
    print(f"1위 감정: {max(result, key=result.get)}")
