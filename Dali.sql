-- 테이블 순서는 관계를 고려하여 한 번에 실행해도 에러가 발생하지 않게 정렬되었습니다.


-- 테이블 생성 SQL - users

CREATE TABLE users (
    user_id    INT          AUTO_INCREMENT PRIMARY KEY            COMMENT '회원고유번호',
    email      VARCHAR(255) NOT NULL                              COMMENT '이메일',
    pwd        VARCHAR(255) NOT NULL                              COMMENT '비밀번호(식별값)',
    nick_name  VARCHAR(20)  NOT NULL                              COMMENT '닉네임',
    gender     CHAR(1)      NOT NULL CHECK (gender IN ('M', 'F')) COMMENT '성별',
    birth_date DATE         NOT NULL                              COMMENT '생년월일',
    provider   VARCHAR(20)  NOT NULL                              COMMENT '로그인제공자',
    created_at DATETIME     NOT NULL DEFAULT NOW()                COMMENT '가입일자',
    
    -- 유니크 제약조건 내부 선언
    UNIQUE (email),
    
    -- 일반 인덱스 내부 선언
    INDEX IX_users_1 (email, name, created_at)
) COMMENT='회원. 사용자 기본 정보';



-- 테이블 생성 SQL - onboardings

CREATE TABLE onboardings (
    onboarding_id INT           AUTO_INCREMENT PRIMARY KEY                                     COMMENT '온보딩고유번호',
    user_id       INT           NOT NULL                                                       COMMENT '회원고유번호',
    question      TEXT          NOT NULL                                                       COMMENT '질의',
    exp_1         VARCHAR(1000) NOT NULL                                                       COMMENT '보기 1',
    exp_2         VARCHAR(1000) NOT NULL                                                       COMMENT '보기 2',
    exp_3         VARCHAR(1000) NOT NULL                                                       COMMENT '보기 3',
    exp_4         VARCHAR(1000) NOT NULL                                                       COMMENT '보기 4',
    exp_5         VARCHAR(1000) NULL                                                           COMMENT '보기 5',
    user_answer   TINYINT       NOT NULL CHECK (user_answer IN (1, 2, 3, 4, 5))                COMMENT '사용자 선택',
    persona       VARCHAR(30)   NOT NULL CHECK (persona IN ('공감형', '친구형', '분석형', '동기부여형')) COMMENT '페르소나',
    created_at    DATETIME      NOT NULL DEFAULT NOW()                                         COMMENT '등록일자',
    
    -- Index 설정 - onboardings(created_at)
    INDEX IX_onboardings_1 (created_at),
    
    -- Foreign Key 설정 - onboardings(user_id) -> users(user_id)
    CONSTRAINT fk_onboardings_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='온보딩. 챗봇 첫 이용 시 설문 응답';

-- Foreign Key 삭제 - onboardings(user_id)
-- ALTER TABLE onboardings DROP FOREIGN KEY fk_onboardings_users;



-- 테이블 생성 SQL - sessions

CREATE TABLE sessions (
    session_id       INT         AUTO_INCREMENT PRIMARY KEY COMMENT '세션고유번호',
    user_id          INT         NOT NULL                   COMMENT '회원고유번호',
    selected_emotion VARCHAR(10) NOT NULL CHECK (selected_emotion IN ('기쁨','슬픔','불안','분노','상처','당황')) COMMENT '선택감정',
    created_at       DATETIME    NOT NULL DEFAULT NOW()     COMMENT '등록일자',
    started_at       DATETIME    NOT NULL DEFAULT NOW()     COMMENT '세션시작시간',
    ended_at         DATETIME    NULL                       COMMENT '세션종료시',
    
    -- 외래키(Foreign Key) 내부 선언
    CONSTRAINT fk_sessions_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='대화세션. AI 챗봇과 진행하는 대화 세션의 시작/종료 정보';

-- Foreign Key 삭제 - sessions(user_id)
-- ALTER TABLE sessions DROP FOREIGN KEY fk_sessions_users;



-- 테이블 생성 SQL - chat_logs

CREATE TABLE chat_logs (
    log_id     INT           AUTO_INCREMENT PRIMARY KEY COMMENT '로그고유번호',
    user_id    INT           NOT NULL                   COMMENT '회원고유번호',
    session_id INT           NOT NULL                   COMMENT '세션고유번호',
    speaker    VARCHAR(10)   NOT NULL                   COMMENT '발화자',
    utterance  VARCHAR(1000) NOT NULL                   COMMENT '발화내용',
    turn_idx   INT           NOT NULL                   COMMENT '발화순서',
    spoken_at  DATETIME      NOT NULL DEFAULT NOW()     COMMENT '발화일시',

    -- Unique 제약조건 내부 선언 (같은 세션에서 동일 순서 발화 불가)
    UNIQUE (session_id, turn_idx),
    
    -- Foreign Key 설정 - chat_logs(user_id) -> users(user_id)
    CONSTRAINT fk_chat_logs_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
        
    -- Foreign Key 설정 - chat_logs(session_id) -> sessions(session_id)
    CONSTRAINT fk_chat_logs_sessions FOREIGN KEY (session_id) 
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='채팅 로그. 말풍선별 실시간 발화 내용을 저장';

-- Foreign Key 삭제 - chat_logs(user_id)
-- ALTER TABLE chat_logs DROP FOREIGN KEY fk_chat_logs_users;

-- Foreign Key 삭제 - chat_logs(session_id)
-- ALTER TABLE chat_logs DROP FOREIGN KEY fk_chat_logs_sessions;



-- 테이블 생성 SQL - chat_analyses

CREATE TABLE chat_analyses (
    analysis_id     INT          AUTO_INCREMENT PRIMARY KEY COMMENT '분석고유번호',
    user_id         INT          NOT NULL                   COMMENT '회원고유번호',
    log_id          INT          NOT NULL                   COMMENT '로그고유번호',
    joy_score       DECIMAL(4,1) NOT NULL DEFAULT 0.0       COMMENT '기쁨 점수',
    sad_score       DECIMAL(4,1) NOT NULL DEFAULT 0.0       COMMENT '슬픔 점수',
    anxiety_score   DECIMAL(4,1) NOT NULL DEFAULT 0.0       COMMENT '불안 점수',
    anger_score     DECIMAL(4,1) NOT NULL DEFAULT 0.0       COMMENT '분노 점수',
    hurt_score      DECIMAL(4,1) NOT NULL DEFAULT 0.0       COMMENT '상처 점수',
    embarrass_score DECIMAL(4,1) NOT NULL DEFAULT 0.0       COMMENT '당황 점수',
    analyzed_at     DATETIME     NOT NULL DEFAULT NOW()     COMMENT '분석일시',
    
    -- Foreign Key 설정 - chat_analyses(log_id) -> chat_logs(log_id)
    CONSTRAINT fk_chat_analyses_chat_logs FOREIGN KEY (log_id) 
        REFERENCES chat_logs (log_id) ON DELETE CASCADE ON UPDATE RESTRICT,
        
    -- Foreign Key 설정 - chat_analyses(user_id) -> users(user_id)
    CONSTRAINT fk_chat_analyses_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='채팅 분석. 말풍선별 감정 점수 결과 저장';

-- Foreign Key 삭제 - chat_analyses(log_id)
-- ALTER TABLE chat_analyses DROP FOREIGN KEY fk_chat_analyses_chat_logs;

-- Foreign Key 삭제 - chat_analyses(user_id)
-- ALTER TABLE chat_analyses DROP FOREIGN KEY fk_chat_analyses_users;



-- 테이블 생성 SQL - session_analyses

CREATE TABLE session_analyses (
    session_analysis_id INT          AUTO_INCREMENT PRIMARY KEY COMMENT '세션분석고유번호',
    session_id          INT          NOT NULL                   COMMENT '세션고유번호',
    user_id             INT          NOT NULL                   COMMENT '회원고유번호',
    joy_score           DECIMAL(4,1) NOT NULL                   COMMENT '기쁨점수',
    sad_score           DECIMAL(4,1) NOT NULL                   COMMENT '슬픔점수',
    anxiety_score       DECIMAL(4,1) NOT NULL                   COMMENT '불안점수',
    anger_score         DECIMAL(4,1) NOT NULL                   COMMENT '분노점수',
    hurt_score          DECIMAL(4,1) NOT NULL                   COMMENT '상처점수',
    embarrass_score     DECIMAL(4,1) NOT NULL                   COMMENT '당황점수',
    dominant_emotion    VARCHAR(10)  NOT NULL CHECK (dominant_emotion IN ('기쁨','슬픔','불안','분노','상처','당황')) COMMENT '대표감정',
    created_at          DATETIME     NOT NULL DEFAULT NOW()     COMMENT '생성일시',
    
    -- Foreign Key 선언 - session_analyses(session_id) -> sessions(session_id)
    CONSTRAINT fk_session_analyses_sessions FOREIGN KEY (session_id) 
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT,

    -- Foreign Key 선언 - session_analyses(user_id) -> users(user_id)    
    CONSTRAINT fk_session_analyses_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='전체대화_감정분석. 전체 대화 세션 감정 분석 결과';

-- Foreign Key 삭제 - session_analyses(session_id)
-- ALTER TABLE session_analyses DROP FOREIGN KEY fk_session_analyses_sessions;

-- Foreign Key 삭제 - session_analyses(user_id)
-- ALTER TABLE session_analyses DROP FOREIGN KEY fk_session_analyses_users;



-- 테이블 생성 SQL - emotion_alerts

CREATE TABLE emotion_alerts (
    e_alert_id        INT         AUTO_INCREMENT PRIMARY KEY                        COMMENT '주의고유번호',
    user_id           INT         NOT NULL                                          COMMENT '회원고유번호',
    alerted_emotion   VARCHAR(10) NOT NULL                                          COMMENT '주의감정',
    alert_reason      VARCHAR(50) NOT NULL                                          COMMENT '주의사유',
    is_confirmed      CHAR(1)     NOT NULL DEFAULT 'N' CHECK (is_confirmed IN ('Y', 'N')) COMMENT '확인여부',
    alerted_at        DATETIME    NOT NULL DEFAULT NOW()                            COMMENT '주의일시',
    resolved_at       DATETIME    NULL                                              COMMENT '해지일시',
    
    -- Foreign Key 설정 - emotion_alerts(user_id) -> users(user_id)
    CONSTRAINT fk_emotion_alerts_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='감정주의신호. 감정 주의 신호 이력';

-- Foreign Key 삭제 - emotion_alerts(user_id)
-- ALTER TABLE emotion_alerts DROP FOREIGN KEY fk_emotion_alerts_users;



-- 테이블 생성 SQL - risk_events
CREATE TABLE risk_events (
    risk_id          INT         AUTO_INCREMENT PRIMARY KEY                               COMMENT '신호고유번호',
    user_id          INT         NOT NULL                                                 COMMENT '회원고유번호',
    session_id       INT         NOT NULL                                                 COMMENT '세션고유번호',
    matched_category VARCHAR(20) NOT NULL                                                 COMMENT '감지분류',
    action_taken     VARCHAR(50) NOT NULL CHECK (action_taken IN ('feedback', 'hotline')) COMMENT '처리결과',
    detected_at      DATETIME    NOT NULL DEFAULT NOW()                                   COMMENT '감지일시',
    
    -- Foreign Key 설정 - risk_events(user_id) -> users(user_id)
    CONSTRAINT fk_risk_events_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
        
    -- Foreign Key 설정 - risk_events(session_id) -> sessions(session_id)
    CONSTRAINT fk_risk_events_sessions FOREIGN KEY (session_id) 
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='고위험신호. 고위험 키워드 신호로그';

-- Foreign Key 삭제 - risk_events(user_id)
-- ALTER TABLE risk_events DROP FOREIGN KEY fk_risk_events_users;

-- Foreign Key 삭제 - risk_events(session_id)
-- ALTER TABLE risk_events DROP FOREIGN KEY fk_risk_events_sessions;



-- 테이블 생성 SQL - summaries

CREATE TABLE summaries (
    summary_id      INT      AUTO_INCREMENT PRIMARY KEY COMMENT '요약고유번호',
    user_id         INT      NOT NULL                   COMMENT '회원고유번호',
    session_id      INT      NOT NULL                   COMMENT '세션고유번호',
    context_summary LONGTEXT NOT NULL                   COMMENT '대화요약',
    created_at      DATETIME NOT NULL DEFAULT NOW()     COMMENT '생성일시',
    
    -- Unique 제약조건 내부 선언 (세션당 1건의 요약만 존재하도록 보장)
    UNIQUE (session_id),
    
    -- Foreign Key 설정 - summaries(user_id) -> users(user_id)
    CONSTRAINT fk_summaries_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
        
    -- Foreign Key 설정 - summaries(session_id) -> sessions(session_id)
    CONSTRAINT fk_summaries_sessions FOREIGN KEY (session_id) 
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='챗봇대화요약. 세션 종료 후 대화 요약';

-- Foreign Key 삭제 - summaries(user_id)
-- ALTER TABLE summaries DROP FOREIGN KEY fk_summaries_users;

-- Foreign Key 삭제 - summaries(session_id)
-- ALTER TABLE summaries DROP FOREIGN KEY fk_summaries_sessions;



-- 테이블 생성 SQL - missions

CREATE TABLE missions (
    mission_id      INT          AUTO_INCREMENT PRIMARY KEY                     COMMENT '미션고유번호',
    user_id         INT          NOT NULL                                       COMMENT '회원고유번호',
    session_id      INT          NOT NULL                                       COMMENT '세션고유번호',
    mission_date    DATE         NOT NULL                                       COMMENT '미션일자',
    mission_seq     INT          NOT NULL CHECK (mission_seq IN (1, 2, 3))      COMMENT '미션순번',
    mission_content VARCHAR(255) NOT NULL                                       COMMENT '미션내용',
    is_completed    CHAR(1)      NOT NULL DEFAULT 'N' CHECK (is_completed IN ('Y', 'N')) COMMENT '수행여부',
    created_at      DATETIME     NOT NULL DEFAULT NOW()                         COMMENT '생성일시',
    completed_at    DATETIME     NULL                                           COMMENT '수행일시',
    
    -- Unique 제약조건 내부 선언 (해당 일자의 미션 순번 중복 방지)
    UNIQUE (mission_date, mission_seq),
    
    -- Foreign Key 설정 - missions(user_id) -> users(user_id)
    CONSTRAINT fk_missions_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
        
    -- Foreign Key 설정 - missions(session_id) -> sessions(session_id)
    CONSTRAINT fk_missions_sessions FOREIGN KEY (session_id) 
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='회복미션. 사용자 맞춤형 회복 미션';

-- Foreign Key 삭제 - missions(user_id)
-- ALTER TABLE missions DROP FOREIGN KEY fk_missions_users;

-- Foreign Key 삭제 - missions(session_id)
-- ALTER TABLE missions DROP FOREIGN KEY fk_missions_sessions;



-- 테이블 생성 SQL - media_contents

CREATE TABLE media_contents (
    media_id   INT          AUTO_INCREMENT PRIMARY KEY                        COMMENT '콘텐츠고유번호',
    media_type VARCHAR(10)  NOT NULL CHECK (media_type IN ('music', 'video')) COMMENT '미디어유형',
    title      VARCHAR(100) NOT NULL                                          COMMENT '제목',
    file_url   VARCHAR(500) NOT NULL                                          COMMENT '파일경로',
    created_at DATETIME     NOT NULL DEFAULT NOW()                            COMMENT '생성일시',
    
    -- Index 설정 - media_contents(created_at)
    INDEX IX_media_contents_1 (created_at)
) COMMENT='음악영상미션. 음악/영상 미션';



-- 테이블 생성 SQL - media_emotions

CREATE TABLE media_emotions (
    media_id INT         NOT NULL       COMMENT '콘텐츠고유번호',
    emotion  VARCHAR(10) NOT NULL CHECK (emotion IN ('기쁨', '슬픔', '불안', '분노', '상처', '당황')) COMMENT '감정',
    
    -- 복합 기본키(Primary Key) 선언
    PRIMARY KEY (media_id, emotion),
    
    -- Foreign Key 설정 - media_emotions(media_id) -> media_contents(media_id)
    CONSTRAINT fk_media_emotions_media_contents FOREIGN KEY (media_id) 
        REFERENCES media_contents (media_id) ON DELETE CASCADE ON UPDATE RESTRICT
) COMMENT='미디어감정. 감정 연걸 - 미디어당 여러 행';

-- Foreign Key 삭제 - media_emotions(media_id)
-- ALTER TABLE media_emotions DROP FOREIGN KEY fk_media_emotions_media_contents;



-- 테이블 생성 SQL - reports

CREATE TABLE reports (
    report_id           INT          AUTO_INCREMENT PRIMARY KEY COMMENT '리포트고유번호',
    user_id             INT          NOT NULL                   COMMENT '회원고유번호',
    session_id          INT          NOT NULL                   COMMENT '세션고유번호',
    session_analysis_id INT          NOT NULL                   COMMENT '세션분석고유번호',
    one_line_review     VARCHAR(255) NOT NULL                   COMMENT '한줄평',
    created_at          DATETIME     NOT NULL DEFAULT NOW()     COMMENT '생성일시',
    
    -- Foreign Key 설정 - reports(user_id) -> users(user_id)
    CONSTRAINT fk_reports_users FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
        
    -- Foreign Key 설정 - reports(session_id) -> sessions(session_id)
    CONSTRAINT fk_reports_sessions FOREIGN KEY (session_id) 
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
        
    -- Foreign Key 설정 - reports(session_analysis_id) -> session_analyses(session_analysis_id)
    CONSTRAINT fk_reports_session_analyses FOREIGN KEY (session_analysis_id) 
        REFERENCES session_analyses (session_analysis_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) COMMENT='감정리포트. 감정 리포트';

-- Foreign Key 삭제 - reports(user_id)
-- ALTER TABLE reports DROP FOREIGN KEY fk_reports_users;

-- Foreign Key 삭제 - reports(session_id)
-- ALTER TABLE reports DROP FOREIGN KEY fk_reports_sessions;

-- Foreign Key 삭제 - reports(session_analysis_id)
-- ALTER TABLE reports DROP FOREIGN KEY fk_reports_session_analyses;