-- 테이블 순서는 관계를 고려하여 한 번에 실행해도 에러가 발생하지 않게 정렬되었습니다.

-- users Table Create SQL
-- 테이블 생성 SQL - users
CREATE TABLE users
(
    `user_id`     INT             NOT NULL    AUTO_INCREMENT COMMENT '회원고유번호', 
    `email`       VARCHAR(255)    NOT NULL    COMMENT '이메일', 
    `pwd`         VARCHAR(255)    NOT NULL    COMMENT '비밀번호(식별값)', 
    `name`        VARCHAR(20)     NOT NULL    COMMENT '이름', 
    `phone`       VARCHAR(20)     NOT NULL    COMMENT '전화번호', 
    `gender`      CHAR(1)         NOT NULL    CHECK (gender IN ('F','M')) COMMENT '성별', 
    `birth_date`  DATE            NOT NULL    COMMENT '생년월일', 
    `provider`    VARCHAR(20)     NOT NULL    COMMENT '로그인제공자', 
    `created_at`  DATETIME        NOT NULL    DEFAULT now() COMMENT '가입일', 
     PRIMARY KEY (user_id)
);

-- 테이블 Comment 설정 SQL - users
ALTER TABLE users COMMENT '회원. 사용자 기본 정보';

-- Index 설정 SQL - users(email, name, created_at)
CREATE INDEX IX_users_1
    ON users(email, name, created_at);

-- Unique Index 설정 SQL - users(email, phone)
CREATE UNIQUE INDEX UQ_users_1
    ON users(email, phone);


-- sessions Table Create SQL
-- 테이블 생성 SQL - sessions
CREATE TABLE sessions
(
    `session_id`        INT            NOT NULL    AUTO_INCREMENT COMMENT '세션고유번호', 
    `user_id`           INT            NOT NULL    COMMENT '회원고유번호', 
    `selected_emotion`  VARCHAR(10)    NOT NULL    COMMENT '선택감정', 
    `created_at`        DATETIME       NOT NULL    DEFAULT now() COMMENT '등록일자', 
    `started_at`        DATETIME       NOT NULL    DEFAULT now() COMMENT '세션시작시간', 
    `ended_at`          DATETIME       NULL        COMMENT '세션종료시', 
     PRIMARY KEY (session_id)
);

-- 테이블 Comment 설정 SQL - sessions
ALTER TABLE sessions COMMENT '대화세션. AI 챗봇과 진행하는 대화 세션의 시작/종료 정보';

-- Foreign Key 설정 SQL - sessions(user_id) -> users(user_id)
ALTER TABLE sessions
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - sessions(user_id)
-- ALTER TABLE sessions
-- DROP FOREIGN KEY ;


-- session_analyses Table Create SQL
-- 테이블 생성 SQL - session_analyses
CREATE TABLE session_analyses
(
    `session_analysis_id`  INT             NOT NULL    AUTO_INCREMENT COMMENT '세션분석고유번호', 
    `session_id`           INT             NOT NULL    COMMENT '세션고유번호', 
    `user_id`              INT             NOT NULL    COMMENT '회원고유번호', 
    `joy_score`            NUMERIC(4,1)    NOT NULL    COMMENT '기쁨점수', 
    `sad_score`            NUMERIC(4,1)    NOT NULL    COMMENT '슬픔점수', 
    `anxiety_score`        NUMERIC(4,1)    NOT NULL    COMMENT '불안점수', 
    `anger_score`          NUMERIC(4,1)    NOT NULL    COMMENT '분노점수', 
    `hurt_score`           NUMERIC(4,1)    NOT NULL    COMMENT '상처점수', 
    `embarrass_score`      NUMERIC(4,1)    NOT NULL    COMMENT '당황점수', 
    `dominant_emotion`     VARCHAR(10)     NOT NULL    COMMENT '대표감정', 
    `created_at`           DATETIME        NOT NULL    DEFAULT now() COMMENT '생성일시', 
     PRIMARY KEY (session_analysis_id)
);

-- 테이블 Comment 설정 SQL - session_analyses
ALTER TABLE session_analyses COMMENT '전체대화_감정분석. 전체 대화 세션 감정 분석 결과';

-- Foreign Key 설정 SQL - session_analyses(session_id) -> sessions(session_id)
ALTER TABLE session_analyses
    ADD CONSTRAINT  FOREIGN KEY (session_id)
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - session_analyses(session_id)
-- ALTER TABLE session_analyses
-- DROP FOREIGN KEY ;

-- Foreign Key 설정 SQL - session_analyses(user_id) -> users(user_id)
ALTER TABLE session_analyses
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - session_analyses(user_id)
-- ALTER TABLE session_analyses
-- DROP FOREIGN KEY ;


-- emotion_logs Table Create SQL
-- 테이블 생성 SQL - emotion_logs
CREATE TABLE emotion_logs
(
    `log_id`      INT              NOT NULL    AUTO_INCREMENT COMMENT '로그고유번호', 
    `user_id`     INT              NOT NULL    COMMENT '회원고유번호', 
    `session_id`  INT              NOT NULL    COMMENT '세션고유번호', 
    `utterance`   VARCHAR(1000)    NOT NULL    COMMENT '발화내용', 
    `turn_idx`    INT              NOT NULL    COMMENT '발화순서', 
    `spoken_at`   DATETIME         NOT NULL    DEFAULT now() COMMENT '발화일시', 
     PRIMARY KEY (log_id)
);

-- 테이블 Comment 설정 SQL - emotion_logs
ALTER TABLE emotion_logs COMMENT '감정로그. 말풍선별 실시간 발화 내용을 저장';

-- Foreign Key 설정 SQL - emotion_logs(user_id) -> users(user_id)
ALTER TABLE emotion_logs
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - emotion_logs(user_id)
-- ALTER TABLE emotion_logs
-- DROP FOREIGN KEY ;

-- Foreign Key 설정 SQL - emotion_logs(session_id) -> sessions(session_id)
ALTER TABLE emotion_logs
    ADD CONSTRAINT  FOREIGN KEY (session_id)
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - emotion_logs(session_id)
-- ALTER TABLE emotion_logs
-- DROP FOREIGN KEY ;


-- media_contents Table Create SQL
-- 테이블 생성 SQL - media_contents
CREATE TABLE media_contents
(
    `media_id`    INT             NOT NULL    AUTO_INCREMENT COMMENT '콘텐츠고유번호', 
    `media_type`  VARCHAR(10)     NOT NULL    COMMENT '미디어유형', 
    `title`       VARCHAR(100)    NOT NULL    COMMENT '제목', 
    `file_url`    VARCHAR(500)    NOT NULL    COMMENT '파일경로', 
    `created_at`  DATETIME        NOT NULL    DEFAULT now() COMMENT '생성일시', 
     PRIMARY KEY (media_id)
);

-- 테이블 Comment 설정 SQL - media_contents
ALTER TABLE media_contents COMMENT '음악영상미션. 음악/영상 미션';

-- Index 설정 SQL - media_contents(created_at)
CREATE INDEX IX_media_contents_1
    ON media_contents(created_at);


-- onboardings Table Create SQL
-- 테이블 생성 SQL - onboardings
CREATE TABLE onboardings
(
    `onboarding_id`  INT              NOT NULL    AUTO_INCREMENT COMMENT '온보딩고유번호', 
    `user_id`        INT              NOT NULL    COMMENT '회원고유번호', 
    `question`       TEXT             NOT NULL    COMMENT '질의', 
    `exp_1`          VARCHAR(1000)    NOT NULL    COMMENT '보기 1', 
    `exp_2`          VARCHAR(1000)    NOT NULL    COMMENT '보기 2', 
    `exp_3`          VARCHAR(1000)    NOT NULL    COMMENT '보기 3', 
    `exp_4`          VARCHAR(1000)    NOT NULL    COMMENT '보기 4', 
    `exp_5`          VARCHAR(1000)    NULL        COMMENT '보기 5', 
    `user_answer`    TINYINT          NOT NULL    COMMENT '사용자 선택', 
    `persona`        VARCHAR(30)      NOT NULL    CHECK (persona IN ('공감형','친구형','분석형', '동기부여형')) COMMENT '페르소나', 
    `created_at`     DATETIME         NOT NULL    DEFAULT now() COMMENT '등록일자', 
     PRIMARY KEY (onboarding_id)
);

-- 테이블 Comment 설정 SQL - onboardings
ALTER TABLE onboardings COMMENT '온보딩. 챗봇 첫 이용 시 설문 응답';

-- Index 설정 SQL - onboardings(created_at)
CREATE INDEX IX_onboardings_1
    ON onboardings(created_at);

-- Foreign Key 설정 SQL - onboardings(user_id) -> users(user_id)
ALTER TABLE onboardings
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - onboardings(user_id)
-- ALTER TABLE onboardings
-- DROP FOREIGN KEY ;


-- log_analyses Table Create SQL
-- 테이블 생성 SQL - log_analyses
CREATE TABLE log_analyses
(
    `analysis_id`      INT             NOT NULL    AUTO_INCREMENT COMMENT '분석고유번호', 
    `user_id`          INT             NOT NULL    COMMENT '회원고유번호', 
    `log_id`           INT             NOT NULL    COMMENT '로그고유번호', 
    `joy_score`        NUMERIC(4,1)    NOT NULL    DEFAULT 0.0 COMMENT '기쁨 점수', 
    `sad_score`        NUMERIC(4,1)    NOT NULL    DEFAULT 0.0 COMMENT '슬픔 점수', 
    `anxiety_score`    NUMERIC(4,1)    NOT NULL    DEFAULT 0.0 COMMENT '불안 점수', 
    `anger_score`      NUMERIC(4,1)    NOT NULL    DEFAULT 0.0 COMMENT '분노 점수', 
    `hurt_score`       NUMERIC(4,1)    NOT NULL    DEFAULT 0.0 COMMENT '상처 점수', 
    `embarrass_score`  NUMERIC(4,1)    NOT NULL    DEFAULT 0.0 COMMENT '당황 점수', 
    `analyzed_at`      DATETIME        NOT NULL    DEFAULT now() COMMENT '분석일시', 
     PRIMARY KEY (analysis_id)
);

-- 테이블 Comment 설정 SQL - log_analyses
ALTER TABLE log_analyses COMMENT '감정분석. 감정 분석 결과';

-- Foreign Key 설정 SQL - log_analyses(log_id) -> emotion_logs(log_id)
ALTER TABLE log_analyses
    ADD CONSTRAINT  FOREIGN KEY (log_id)
        REFERENCES emotion_logs (log_id) ON DELETE CASCADE ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - log_analyses(log_id)
-- ALTER TABLE log_analyses
-- DROP FOREIGN KEY ;

-- Foreign Key 설정 SQL - log_analyses(user_id) -> users(user_id)
ALTER TABLE log_analyses
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - log_analyses(user_id)
-- ALTER TABLE log_analyses
-- DROP FOREIGN KEY ;


-- summaries Table Create SQL
-- 테이블 생성 SQL - summaries
CREATE TABLE summaries
(
    `summary_id`       INT         NOT NULL    AUTO_INCREMENT COMMENT '요약고유번호', 
    `user_id`          INT         NOT NULL    COMMENT '회원고유번호', 
    `session_id`       INT         NOT NULL    COMMENT '세션고유번호', 
    `context_summary`  LONGTEXT    NOT NULL    COMMENT '대화요약', 
    `created_at`       DATETIME    NOT NULL    DEFAULT now() COMMENT '생성일시', 
     PRIMARY KEY (summary_id)
);

-- 테이블 Comment 설정 SQL - summaries
ALTER TABLE summaries COMMENT '챗봇대화요약. 세션 종류 후 대화 요약';

-- Foreign Key 설정 SQL - summaries(user_id) -> users(user_id)
ALTER TABLE summaries
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - summaries(user_id)
-- ALTER TABLE summaries
-- DROP FOREIGN KEY ;

-- Foreign Key 설정 SQL - summaries(session_id) -> sessions(session_id)
ALTER TABLE summaries
    ADD CONSTRAINT  FOREIGN KEY (session_id)
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - summaries(session_id)
-- ALTER TABLE summaries
-- DROP FOREIGN KEY ;


-- emortion_alerts Table Create SQL
-- 테이블 생성 SQL - emortion_alerts
CREATE TABLE emortion_alerts
(
    `e_alert_id`         INT            NOT NULL    AUTO_INCREMENT COMMENT '주의고유번호', 
    `user_id`            INT            NOT NULL    COMMENT '회원고유번호', 
    `triggered_emotion`  VARCHAR(10)    NOT NULL    COMMENT '발동감정', 
    `trigger_reason`     VARCHAR(50)    NOT NULL    COMMENT '발동사유', 
    `is_confirmed`       CHAR(1)        NOT NULL    DEFAULT '' COMMENT '확인여부', 
    `triggered_at`       DATETIME       NOT NULL    DEFAULT now() COMMENT '발동일시', 
    `resolved_at`        DATETIME       NULL        COMMENT '해지일시', 
     PRIMARY KEY (e_alert_id)
);

-- 테이블 Comment 설정 SQL - emortion_alerts
ALTER TABLE emortion_alerts COMMENT '감정주의신호. 감정 주의 신호 이력';

-- Foreign Key 설정 SQL - emortion_alerts(user_id) -> users(user_id)
ALTER TABLE emortion_alerts
    ADD CONSTRAINT FK_emortion_alerts_user_id_users_user_id FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - emortion_alerts(user_id)
-- ALTER TABLE emortion_alerts
-- DROP FOREIGN KEY FK_emortion_alerts_user_id_users_user_id;


-- risk_events Table Create SQL
-- 테이블 생성 SQL - risk_events
CREATE TABLE risk_events
(
    `risk_id`           INT            NOT NULL    AUTO_INCREMENT COMMENT '신호고유번호', 
    `user_id`           INT            NOT NULL    COMMENT '회원고유번호', 
    `session_id`        INT            NOT NULL    COMMENT '세션고유번호', 
    `matched_category`  VARCHAR(20)    NOT NULL    COMMENT '감지분류', 
    `action_taken`      VARCHAR(50)    NOT NULL    COMMENT '처리결과', 
    `detected_at`       DATETIME       NOT NULL    DEFAULT now() COMMENT '감지일시', 
     PRIMARY KEY (risk_id)
);

-- 테이블 Comment 설정 SQL - risk_events
ALTER TABLE risk_events COMMENT '고위험신호. 고위험 키워드 신호로그';

-- Foreign Key 설정 SQL - risk_events(user_id) -> users(user_id)
ALTER TABLE risk_events
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - risk_events(user_id)
-- ALTER TABLE risk_events
-- DROP FOREIGN KEY ;

-- Foreign Key 설정 SQL - risk_events(session_id) -> sessions(session_id)
ALTER TABLE risk_events
    ADD CONSTRAINT  FOREIGN KEY (session_id)
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - risk_events(session_id)
-- ALTER TABLE risk_events
-- DROP FOREIGN KEY ;


-- missions Table Create SQL
-- 테이블 생성 SQL - missions
CREATE TABLE missions
(
    `mission_id`       INT             NOT NULL    AUTO_INCREMENT COMMENT '미션고유번호', 
    `user_id`          INT             NOT NULL    COMMENT '회원고유번호', 
    `session_id`       INT             NOT NULL    COMMENT '세션고유번호', 
    `mission_date`     DATE            NOT NULL    COMMENT '미션일자', 
    `mission_seq`      INT             NOT NULL    COMMENT '미션순번', 
    `mission_content`  VARCHAR(255)    NOT NULL    COMMENT '미션내용', 
    `is_completed`     CHAR(1)         NOT NULL    DEFAULT 'N' COMMENT '수행여부', 
    `created_at`       DATETIME        NOT NULL    DEFAULT now() COMMENT '생성일시', 
    `completed_at`     DATETIME        NULL        COMMENT '수행일시', 
     PRIMARY KEY (mission_id)
);

-- 테이블 Comment 설정 SQL - missions
ALTER TABLE missions COMMENT '회복미션. 사용자 맞춤형 회복 미션';

-- Foreign Key 설정 SQL - missions(user_id) -> users(user_id)
ALTER TABLE missions
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - missions(user_id)
-- ALTER TABLE missions
-- DROP FOREIGN KEY ;

-- Foreign Key 설정 SQL - missions(session_id) -> sessions(session_id)
ALTER TABLE missions
    ADD CONSTRAINT  FOREIGN KEY (session_id)
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - missions(session_id)
-- ALTER TABLE missions
-- DROP FOREIGN KEY ;


-- media_emotions Table Create SQL
-- 테이블 생성 SQL - media_emotions
CREATE TABLE media_emotions
(
    `media_id`  INT            NOT NULL    COMMENT '콘텐츠고유번호', 
    `emotion`   VARCHAR(10)    NOT NULL    COMMENT '감정', 
     PRIMARY KEY (media_id, emotion)
);

-- 테이블 Comment 설정 SQL - media_emotions
ALTER TABLE media_emotions COMMENT '미디어감정. 감정 연걸 - 미디어당 여러 행';

-- Foreign Key 설정 SQL - media_emotions(media_id) -> media_contents(media_id)
ALTER TABLE media_emotions
    ADD CONSTRAINT  FOREIGN KEY (media_id)
        REFERENCES media_contents (media_id) ON DELETE CASCADE ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - media_emotions(media_id)
-- ALTER TABLE media_emotions
-- DROP FOREIGN KEY ;


-- reports Table Create SQL
-- 테이블 생성 SQL - reports
CREATE TABLE reports
(
    `report_id`            INT             NOT NULL    AUTO_INCREMENT COMMENT '리포트고유번호', 
    `user_id`              INT             NOT NULL    COMMENT '회원고유번호', 
    `session_id`           INT             NOT NULL    COMMENT '세션고유번호', 
    `session_analysis_id`  INT             NOT NULL    COMMENT '세션분석고유번호', 
    `one_line_review`      VARCHAR(255)    NOT NULL    COMMENT '한줄평', 
    `created_at`           DATETIME        NOT NULL    DEFAULT now() COMMENT '생성일시', 
     PRIMARY KEY (report_id)
);

-- 테이블 Comment 설정 SQL - reports
ALTER TABLE reports COMMENT '감정리포트. 감정 리포트';

-- Foreign Key 설정 SQL - reports(user_id) -> users(user_id)
ALTER TABLE reports
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - reports(user_id)
-- ALTER TABLE reports
-- DROP FOREIGN KEY ;

-- Foreign Key 설정 SQL - reports(session_id) -> sessions(session_id)
ALTER TABLE reports
    ADD CONSTRAINT  FOREIGN KEY (session_id)
        REFERENCES sessions (session_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - reports(session_id)
-- ALTER TABLE reports
-- DROP FOREIGN KEY ;

-- Foreign Key 설정 SQL - reports(session_analysis_id) -> session_analyses(session_analysis_id)
ALTER TABLE reports
    ADD CONSTRAINT  FOREIGN KEY (session_analysis_id)
        REFERENCES session_analyses (session_analysis_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - reports(session_analysis_id)
-- ALTER TABLE reports
-- DROP FOREIGN KEY ;


-- settings Table Create SQL
-- 테이블 생성 SQL - settings
CREATE TABLE settings
(
    `user_id`             INT           NOT NULL        COMMENT '회원고유번호', 
    `checkin_alert_yn`    CHAR(1)       NOT NULL    DEFAULT 'N' COMMENT '체크인 알림 수신여부', 
    `checkin_alert_time`  VARCHAR(5)    NOT NULL    COMMENT '체크인 알림 시간대', 
    `mission_alert_yn`    CHAR(1)       NOT NULL    DEFAULT 'N' COMMENT '미션알림 수신여부', 
    `mission_alert_time`  VARCHAR(5)    NOT NULL    COMMENT '미션알림 시간대', 
    `created_at`          DATETIME      NOT NULL    DEFAULT now() COMMENT '등록일시', 
    `updated_at`          DATETIME      NULL        COMMENT '수정일자', 
     PRIMARY KEY (user_id)
);

-- 테이블 Comment 설정 SQL - settings
ALTER TABLE settings COMMENT '사용자알림설정. 알림 설정';

-- Foreign Key 설정 SQL - settings(user_id) -> users(user_id)
ALTER TABLE settings
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - settings(user_id)
-- ALTER TABLE settings
-- DROP FOREIGN KEY ;


-- login_alerts Table Create SQL
-- 테이블 생성 SQL - login_alerts
CREATE TABLE login_alerts
(
    `alert_id`       INT            NOT NULL    AUTO_INCREMENT COMMENT '알림 고유번호', 
    `user_id`        INT            NOT NULL    COMMENT '회원 고유번호', 
    `alert_type`     VARCHAR(20)    NOT NULL    COMMENT '알림 구분', 
    `alert_text`     TEXT           NOT NULL    COMMENT '알림 내용', 
    `alert_time`     DATETIME       NOT NULL    COMMENT '알림 발송 시간', 
    `is_received`    CHAR(1)        NOT NULL    DEFAULT 'N' COMMENT '알림 수신 여부', 
    `received_time`  DATETIME       NULL        COMMENT '알림 수신 시간', 
     PRIMARY KEY (alert_id)
);

-- 테이블 Comment 설정 SQL - login_alerts
ALTER TABLE login_alerts COMMENT '로그인 알림';

-- Index 설정 SQL - login_alerts(alert_time)
CREATE INDEX IX_login_alerts_1
    ON login_alerts(alert_time);

-- Foreign Key 설정 SQL - login_alerts(user_id) -> users(user_id)
ALTER TABLE login_alerts
    ADD CONSTRAINT FK_login_alerts_user_id_users_user_id FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - login_alerts(user_id)
-- ALTER TABLE login_alerts
-- DROP FOREIGN KEY FK_login_alerts_user_id_users_user_id;


