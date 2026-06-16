/*
 * errorHandler - 커스텀 에러 클래스 + 공통 에러 핸들러
 *
 * 에러 응답 형식: { code, message }
 * - code   : 프론트 분기용 고정 문자열 (프론트팀과 확정 필요)
 * - message: 사람이 읽는 설명
 *
 * HTTP 상태 코드
 * - 400 Bad Request     잘못된 요청 (필수값 누락, 형식 오류)
 * - 401 Unauthorized    인증 실패 (토큰 없음/만료, 로그인 실패)
 * - 403 Forbidden       접근 권한 없음 (IDOR)
 * - 404 Not Found       리소스 없음
 * - 409 Conflict        중복 데이터
 * - 500 Internal Error  서버 내부 오류
 * - 502 Bad Gateway     외부 서버 오류 (FastAPI 연결 실패)
 */

class AppError extends Error {
  constructor(message, statusCode = 400, code = 'ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// 하위 호환 유지
class ValidationError extends AppError {
  constructor(message, statusCode = 400, code = 'INVALID_REQUEST') {
    super(message, statusCode, code);
    this.name = 'ValidationError';
  }
}

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ code: err.code, message: err.message });
  }

  if (err.isAxiosError) {
    console.error('[EXTERNAL API ERROR]', {
      url: err.config?.url,
      status: err.response?.status,
      data: err.response?.data,
    });
    return res.status(502).json({ code: 'BAD_GATEWAY', message: '외부 서버 연결에 실패했습니다.' });
  }

  console.error('[SERVER ERROR]', err.message || err);
  return res.status(500).json({ code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' });
};

module.exports = { AppError, ValidationError, errorHandler };
