/*
 * riskKeywords - 고위험 키워드 목록
 *
 * 역할:
 * Node에서 사용자 발화를 FastAPI로 보내기 전 1차 키워드 감지에 사용
 * 키워드 감지 시 FastAPI(LLM)에 has_risk_keyword: true 플래그 전달
 * → LLM이 전체 문맥을 보고 실제 위기 여부를 최종 판단
 *
 * 왜 LLM에 최종 판단을 맡기나:
 * 키워드 단독 감지는 "더워서 죽겠다" 같은 일상 표현도 오탐할 수 있음
 * Node는 빠른 1차 필터 역할만 하고, 문맥 판단은 LLM이 담당
 *
 * 키워드 추가/수정 시 이 파일만 수정하면 됨
 */

const RISK_KEYWORDS = [
  // 팀 회의 후 확정 예정
];

module.exports = RISK_KEYWORDS;
