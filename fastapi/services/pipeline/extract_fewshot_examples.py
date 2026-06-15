"""AI Hub 공감형 대화 라벨링 데이터에서 페르소나 4종 few-shot 예시를 추출한다.

책임 경계: 라벨링(.json) 데이터만 입력으로 받아 {사용자 발화 -> 코치 응답} 쌍을
페르소나별로 골라 JSON 4개로 출력한다. 원천(.tsv) 데이터·zip 디스크 해제는 다루지 않는다.
zip은 메모리에서 zipfile로 열어 바이트째 읽고, 깨진 한글 파일명은 사용하지 않는다.
"""

import io
import json
import os
import re
import zipfile

# --- 경로 (한 곳에만) ------------------------------------------------------
# 코드 위치 기준으로 잡아 폴더를 옮겨도 깨지지 않게 한다.
# 원본 라벨링 데이터셋은 용량이 커서 1주차 자료에 그대로 두고 거기서 읽는다(A안).
HERE = os.path.dirname(os.path.abspath(__file__))   # Dali/pipeline
DALI = os.path.dirname(HERE)                          # Dali
PROJECT_ROOT = os.path.dirname(DALI)                  # 최종프로젝트
LABEL_DIR = os.path.join(
    PROJECT_ROOT, "1주차 사전조사 및 약식기획서 자료",
    "공감대화 데이터셋", "046.공감형 대화", "01-1.정식개방데이터",
    "Training", "02.라벨링데이터",
)
OUT_DIR = os.path.join(DALI, "fewshot")

TAG_TO_PERSONA = {"위로": "공감형", "조언": "분석형", "격려": "동기부여형", "동조": "친구형"}
POLITE_PERSONAS = ("공감형", "분석형", "동기부여형")
EMOTIONS = ("기쁨", "슬픔", "불안", "분노", "상처", "당황")

PER_PERSONA = 12          # 페르소나당 예시 개수
PER_EMOTION = 2           # 감정당 예시 개수 (6감정 x 2 = 12)
SHORT_LIMIT = 80          # 코치 응답 글자수 우선 기준

# 문장 종결어미 (말투 판정)
POLITE_ENDINGS = ("습니다", "니다", "세요", "에요", "예요", "네요", "지요", "까요", "죠", "요")
BANMAL_ENDINGS = ("구나", "란다", "거든", "대", "래", "해", "야", "어", "아")
ELDER_ENDINGS = ("구나", "렴", "란다", "단다", "했니", "거니")  # 친구형 탈락(윗사람 말투)

# 가족·특수 호칭 (존댓말 3종 + 친구형 모두 제외)
FAMILY_TERMS = (
    "엄마", "아빠", "어머니", "아버지", "당신", "여보",
    "딸", "아들", "손주", "오빠", "누나", "언니",
)

# AI Hub 화자 익명화 마스킹 토큰 (few-shot 예시에 들어가면 안 됨)
MASK_PATTERN = re.compile(r"(감정|공감)(화자|청자)")

# 마무리(작별·감사) 인사 신호 — 사용자 발화/코치 응답 어디든 있으면 그 쌍 제외.
# 목적: 사용자가 아직 감정·고민을 털어놓는 장면만 남기고, 풀린 마무리 장면은 버린다.
FAREWELL_SIGNALS = (
    "고마워", "고맙", "감사", "덕분", "또 연락", "연락할게", "연락드릴",
    "잘 지내", "수고", "다녀올게", "들어가", "이만", "안녕",
    "뵐게", "뵈어", "만나요", "식사해요", "파이팅", "화이팅",
)

# 공감형 제외 — 비꼼·판단·훈수성 응답(사용자 감정 수용이 아닌 평가).
JUDGMENTAL_WORDS = (
    "배워야", "다시 배", "그러게", "쌤통", "당해도", "당해야", "자업자득",
    "못됐", "못된", "한심", "어이없", "제정신", "정신 차", "벌 받",
    "천벌", "꼴좋", "싸네요", "싸요", "혼나야", "혼쭐",
)

# 분석형 제외 — 단순 반응(내용 없는 짧은 지시) + 까칠·냉정한 톤.
SIMPLE_OR_COLD_WORDS = (
    "조심하세요", "조심해요", "조심하셔", "다녀와요", "다녀오세요",
    "드세요", "쉬세요", "푹 쉬", "건강하세요", "건강 챙기",
    "당연하", "어쩔 수 없", "네 탓", "본인 탓", "참으세요", "감수하",
)

# 결과 단정(미래 긍정 결과 보장) — 4종 공통 제외.
# 근거: 절대 제약 "공감 != 확언"(결과 약속 금지). few-shot에 들어가면 LLM이 확언을 모방.
RESULT_PROMISE_WORDS = (
    "괜찮아질", "괜찮아 질", "나아질 거", "좋아질 거", "해결될 거",
    "잘될 거", "잘 될 거", "다 잘될", "다 잘 될",
    "좋은 일이 생길", "좋은 일이 있을", "좋은 일만", "잘 풀릴",
    "성공할 거", "성공할 겁", "이뤄질 거", "이루어질 거",
    "행복해질", "복 받을", "복이 올",
)


def is_result_promise(text):
    """미래 긍정 결과를 보장하는 확언 표현이 있으면 True."""
    return any(w in text for w in RESULT_PROMISE_WORDS)


def is_masked(text):
    """익명화 마스킹 토큰이 들어 있으면 True."""
    return bool(MASK_PATTERN.search(text))


def is_farewell(text):
    """작별·감사 등 마무리 인사 신호가 들어 있으면 True."""
    return any(sig in text for sig in FAREWELL_SIGNALS)


def is_judgmental(text):
    """공감형에서 거를 비꼼·판단·훈수 표현이 있으면 True."""
    return any(w in text for w in JUDGMENTAL_WORDS)


def is_simple_or_cold(text):
    """분석형에서 거를 단순 반응·냉정한 톤이 있으면 True."""
    return any(w in text for w in SIMPLE_OR_COLD_WORDS)


def split_sentences(text):
    """응답 텍스트를 문장 단위로 쪼개 어미 검사가 가능한 조각 리스트로 돌려준다."""
    parts = re.split(r"[.!?~…\n]+", text)
    out = []
    for p in parts:
        p = p.strip().strip("\"'“”‘’()[]")
        if p:
            out.append(p)
    return out


def has_family_term(text):
    """가족·특수 호칭이 들어 있으면 True."""
    return any(term in text for term in FAMILY_TERMS)


def is_polite(text):
    """모든 문장이 반말 종결이 아니고, 최소 한 문장이 존댓말 종결이면 True(보수적)."""
    sentences = split_sentences(text)
    if not sentences:
        return False
    saw_polite = False
    for s in sentences:
        if s.endswith(POLITE_ENDINGS):
            saw_polite = True
        elif s.endswith(BANMAL_ENDINGS):
            return False  # 반말 문장이 하나라도 있으면 탈락
    return saw_polite


def is_casual_peer(text):
    """또래 반말이면 True. 존댓말·윗사람 말투·가족 호칭이 있으면 False."""
    if has_family_term(text):
        return False
    sentences = split_sentences(text)
    if not sentences:
        return False
    for s in sentences:
        if s.endswith(POLITE_ENDINGS):
            return False  # 존댓말 탈락
        if s.endswith(ELDER_ENDINGS):
            return False  # 윗사람 말투 탈락
    return True


def passes_persona_tone(persona, relation, response):
    """페르소나별 말투·관계 필터. 통과하면 True."""
    if persona in POLITE_PERSONAS:
        if has_family_term(response):
            return False
        return is_polite(response)
    # 친구형
    if relation != "친구":
        return False
    return is_casual_peer(response)


def prev_speaker_text(utterances, idx):
    """idx번째(코치 발화) 직전의 가장 가까운 speaker 발화 텍스트. 없으면 None."""
    for j in range(idx - 1, -1, -1):
        if utterances[j].get("role") == "speaker":
            return (utterances[j].get("text") or "").strip()
    return None


def iter_label_records(zip_path):
    """하나의 zip에서 대화 JSON dict를 순서대로 yield. 깨진/비JSON 엔트리는 건너뛴다."""
    with zipfile.ZipFile(zip_path) as zf:
        for name in zf.namelist():
            if name.endswith("/") or not name.endswith(".json"):
                continue
            raw = zf.read(name)
            try:
                yield json.loads(io.BytesIO(raw).read().decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue


def collect_candidates():
    """모든 zip을 훑어 페르소나->감정->후보쌍 리스트를 모은다."""
    buckets = {p: {e: [] for e in EMOTIONS} for p in TAG_TO_PERSONA.values()}
    seen = {p: set() for p in TAG_TO_PERSONA.values()}  # 응답 중복 제거

    zip_files = sorted(
        f for f in os.listdir(LABEL_DIR)
        if f.startswith("TL_") and f.endswith(".zip")
    )
    for fname in zip_files:
        for data in iter_label_records(os.path.join(LABEL_DIR, fname)):
            info = data.get("info", {})
            if (info.get("evaluation") or {}).get("grade") != "우수":
                continue
            emotion = info.get("speaker_emotion")
            relation = info.get("relation")
            if emotion not in EMOTIONS:
                continue
            utts = data.get("utterances", [])
            for i, u in enumerate(utts):
                if u.get("role") != "listener":
                    continue
                tags = u.get("listener_empathy")
                if not tags or len(tags) != 1:
                    continue
                persona = TAG_TO_PERSONA.get(tags[0])
                if not persona:
                    continue
                response = (u.get("text") or "").strip()
                user_utt = prev_speaker_text(utts, i)
                if not response or not user_utt:
                    continue
                if is_masked(response) or is_masked(user_utt):
                    continue  # 익명화 토큰 든 쌍 제외
                if is_farewell(response) or is_farewell(user_utt):
                    continue  # 마무리 인사 장면 제외 (4종 공통)
                if is_result_promise(response):
                    continue  # 결과 단정(확언) 제외 (4종 공통, 절대 제약)
                if not passes_persona_tone(persona, relation, response):
                    continue
                if persona == "공감형" and is_judgmental(response):
                    continue  # 비꼼·판단성 응답 제외
                if persona == "분석형" and is_simple_or_cold(response):
                    continue  # 단순 반응·냉정한 톤 제외
                if response in seen[persona]:
                    continue
                seen[persona].add(response)
                buckets[persona][emotion].append(
                    {"감정": emotion, "사용자 발화": user_utt, "코치 응답": response}
                )
    return buckets


def pick_examples(buckets):
    """감정당 PER_EMOTION개씩, 80자 이내 우선(짧은 순)으로 선별한다."""
    result = {p: [] for p in buckets}
    shortfall = {}
    for persona, by_emotion in buckets.items():
        for emotion in EMOTIONS:
            cands = sorted(
                by_emotion[emotion],
                key=lambda x: (len(x["코치 응답"]) > SHORT_LIMIT, len(x["코치 응답"])),
            )
            chosen = cands[:PER_EMOTION]
            result[persona].extend(chosen)
            if len(chosen) < PER_EMOTION:
                shortfall[(persona, emotion)] = (len(chosen), PER_EMOTION)
    return result, shortfall


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    buckets = collect_candidates()
    result, shortfall = pick_examples(buckets)

    for persona, examples in result.items():
        out_path = os.path.join(OUT_DIR, f"{persona}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(examples, f, ensure_ascii=False, indent=2)

    # 보고용 집계 출력 (자가평가 아님 — 사실 수치만)
    report = {
        "counts": {p: len(ex) for p, ex in result.items()},
        "by_emotion": {
            p: {e: sum(1 for x in ex if x["감정"] == e) for e in EMOTIONS}
            for p, ex in result.items()
        },
        "candidate_pool": {
            p: {e: len(buckets[p][e]) for e in EMOTIONS} for p in buckets
        },
        "shortfall": {f"{k[0]}/{k[1]}": v for k, v in shortfall.items()},
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
