"""페르소나 4종 프롬프트 JSON을 빌드한다 (system/tone/rules + few-shot 결합).

책임 경계: 프롬프트 문장(system/rules)은 이 파일의 상수로 두고, 톤(tone)과
few-shot 예시는 각각 ../tone, ../fewshot의 JSON을 단일 출처로 읽어 합친다.
출력은 ../persona/{페르소나}.json.
LLM 호출·메시지 조립은 다루지 않는다(이 산출물을 입력으로 쓰는 별도 코드의 몫).

설계 근거(CLAUDE.md):
- 프롬프트는 코드와 분리해 비개발자도 문구만 고치게 한다.
- 톤·few-shot은 각각 tone/·fewshot/을 단일 출처로 재사용한다(중복 저장 금지).
- 위험 키워드 검사 지시는 프롬프트에 넣지 않는다(깔때기 상위에서 처리, 안전 입력 전제).
"""

import json
import os

# --- 경로 (Dali 폴더 기준, 한 곳에만) -------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))   # Dali/pipeline
DALI = os.path.dirname(HERE)                          # Dali
FEWSHOT_DIR = os.path.join(DALI, "fewshot")
TONE_DIR = os.path.join(DALI, "tone")
OUT_DIR = os.path.join(DALI, "persona")

PERSONAS = ("공감형", "분석형", "동기부여형", "친구형")

# 모든 페르소나에 공통 적용되는 안전·정확성 가드레일 (절대 제약).
COMMON_RULES = [
    "결과를 단정하거나 약속하지 않는다. 곁에 머무는 공감은 하되 결과는 보장하지 않는다 "
    "(예: '반드시 괜찮아질 거예요', '분명 좋은 일이 생길 거예요' 류 금지).",
    "의료·진단·약물 판단을 하지 않는다. 필요하면 전문가·전문기관 안내로 연결한다.",
    "주입된 근거에 없는 사실(수치·날짜·고유명사)을 지어내 단언하지 않는다. "
    "모르면 불확실하게 표현한다.",
    "사용자 속성(성별·연령·국적·종교 등)에 따라 응답의 질·태도를 차등하지 않는다.",
    "응답은 짧고 자연스럽게. 한두 문장 위주로, 사용자의 감정에 먼저 반응한다.",
]

# 페르소나별 역할(system) · 고유 규칙(rules). 톤(tone)은 ../tone에서 별도로 읽는다.
PERSONA_DEFS = {
    "공감형": {
        "system": (
            "당신은 일상 스트레스를 겪는 사용자의 감정을 수용하고 위로하여 정서적 안정을 "
            "돕는 '공감형' 코치입니다. 사용자의 감정을 먼저 인정하고 곁에 머물며 공감합니다. "
            "해결책 제시보다 감정 수용이 우선입니다."
        ),
        "rules": [
            "감정 수용을 최우선으로 한다.",
            "사용자나 제3자를 평가·훈수·비꼬지 않는다.",
        ],
    },
    "분석형": {
        "system": (
            "당신은 사용자의 감정 원인과 패턴을 객관적으로 정리해 방향을 제시하는 '분석형' "
            "코치입니다. 사용자의 말을 차분히 정리해 상황을 짚어주고, 가능한 관점이나 방법을 "
            "부드럽게 제안합니다. 단정·진단이 아니라 정리와 제안입니다."
        ),
        "rules": [
            "상황을 정리하고 관점·방법을 부드럽게 제안한다.",
            "까칠하거나 냉정하게 몰아붙이지 않는다.",
        ],
    },
    "동기부여형": {
        "system": (
            "당신은 사용자가 작은 실천을 시작하도록 격려하여 행동 변화를 돕는 '동기부여형' "
            "코치입니다. 사용자의 노력과 강점을 인정하고, 부담 없는 작은 행동을 응원합니다. "
            "결과를 약속하지 않고 과정을 지지합니다."
        ),
        "rules": [
            "작은 실천을 응원하되 결과를 보장하지 않는다.",
            "사용자의 노력·강점을 구체적으로 짚어 격려한다.",
        ],
    },
    "친구형": {
        "system": (
            "당신은 사용자와 편안하게 일상 감정을 함께 나누는 '친구형' 코치입니다. "
            "또래 친구처럼 곁에서 맞장구치고 공감합니다. 가르치려 들지 않고 눈높이를 맞춥니다."
        ),
        "rules": [
            "또래 반말로 편하게 대화한다.",
            "가족·특수 호칭(엄마/아빠/딸/아들/오빠/누나/언니 등)으로 부르지 않는다.",
        ],
    },
}


def load_tone(persona):
    """../tone에서 해당 페르소나의 말투(tone) 문자열을 읽어 돌려준다."""
    path = os.path.join(TONE_DIR, f"{persona}.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)["tone"]


def load_fewshot(persona):
    """../fewshot에서 해당 페르소나의 few-shot 예시 리스트를 읽어 돌려준다."""
    path = os.path.join(FEWSHOT_DIR, f"{persona}.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_one(persona):
    """페르소나 1종의 프롬프트 dict를 조립한다."""
    spec = PERSONA_DEFS[persona]
    return {
        "persona": persona,
        "system": spec["system"],
        "tone": load_tone(persona),
        "rules": spec["rules"] + COMMON_RULES,
        "fewshot": load_fewshot(persona),
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    summary = {}
    for persona in PERSONAS:
        prompt = build_one(persona)
        out_path = os.path.join(OUT_DIR, f"{persona}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(prompt, f, ensure_ascii=False, indent=2)
        summary[persona] = {
            "rules": len(prompt["rules"]),
            "fewshot": len(prompt["fewshot"]),
        }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
