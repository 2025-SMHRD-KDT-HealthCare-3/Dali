/*
 * sessionStore - 단일 세션 강제용 인메모리 저장소 (중복 로그인 차단)
 *
 * user_id 당 가장 최근에 발급한 세션 식별자(sid) 하나만 유지한다.
 * 로그인 시 새 sid로 덮어쓰면, 이전 기기의 토큰은 sid가 달라져 차단된다.
 *
 * [완화 설계] 기록이 "있고 다를 때만" 차단하고, 기록이 없으면(서버 재시작/nodemon 리로드 등
 * 으로 Map이 비워진 경우) 통과시킨다. → 재시작 때마다 전원 강제 로그아웃되는 불편을 피한다.
 *
 * ⚠️ 휘발성(RAM). 서버 재시작 시 비워지고, 서버를 여러 대로 늘리면 인스턴스 간 공유되지 않는다.
 *    운영 배포/다중화 단계에서는 users.token_version(DB) 방식으로 승격할 것.
 */

const activeSessions = new Map(); // user_id -> sid

function setSession(user_id, sid) {
  activeSessions.set(user_id, sid);
}

function clearSession(user_id) {
  activeSessions.delete(user_id);
}

// 토큰의 sid가 현재 등록된 세션과 다르면 true(=다른 기기에서 새로 로그인됨 → 차단 대상).
// 등록된 기록이 없으면 false(통과) — 완화 설계.
function isReplaced(user_id, sid) {
  const current = activeSessions.get(user_id);
  return current !== undefined && current !== sid;
}

module.exports = { setSession, clearSession, isReplaced };
