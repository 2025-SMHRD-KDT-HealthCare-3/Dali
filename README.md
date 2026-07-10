# LLM 기반 공감 대화와 복합 감정 분석 모델을 활용한 감정 회복 코치 서비스

> 프로젝트 초기 설정 가이드 (팀원용)

---

## 📁 프로젝트 구조

```
~/Dali/
├── .env                    # 생성필요
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dali.sql
├── README.md
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── assets/
│       ├── pages/          # 페이지 컴포넌트
│       ├── components/     # 공용 컴포넌트
│       └── styles/         # 디자인 토큰 (design.js)
├── node/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── server.js
│   ├── routes/             # URL 연결 및 미들웨어 적용
│   │   └── index.js        # 라우터 통합 분배
│   ├── controllers/        # 요청 처리, 조건 분기, 응답 구성
│   ├── repositories/       # DB 쿼리
│   ├── middleware/         # 인증, 에러 핸들링
│   └── config/             # DB, API 설정
└── fastapi/
    ├── Dockerfile
    ├── .dockerignore
    ├── main.py
    ├── requirements.txt
    ├── middleware/          # 에러 핸들링
    ├── model/               # 학습 모델 파일
    ├── services/            # AI 서비스 로직
    ├── chroma_db/           # 벡터 DB
    └── utils/               # 전처리, 점수 산출, 내부 API 키 검증
```

---

## ⚙️ 개발 환경 설정 (최초 1회)

> WSL Ubuntu 환경에서 처음 세팅하는 경우 아래 순서대로 진행하세요.

### 1. WSL(Ubuntu) 접속

윈도우 검색창에서 `WSL` 실행 후 홈 디렉토리로 이동합니다.

```bash
cd ~
```

### 2. Git 설치 확인 및 초기 설정

```bash
git --version
```

버전이 출력되지 않으면 설치합니다.

```bash
sudo apt update
sudo apt install git -y
git --version  # 정상적으로 버전이 뜨는지 확인 (git version 2.43.0)
```

Git 사용자 정보를 설정합니다. (최초 1회)

```bash
# 이름 설정
git config --global user.name "본인 영문이니셜 (예: KYH)"

# 이메일 설정 (GitHub 가입 시 사용한 이메일)
git config --global user.email "이메일"

# 설정 확인
git config --list
```

### 3. Node.js 설치 (NVM 사용)

```bash
# nvm 설치 (2026년 기준 최신 스크립트)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 터미널 재시작 없이 nvm 바로 적용 (또는 터미널을 껐다가 다시 켜기)
source ~/.bashrc

# Node.js LTS(안정화) 최신 버전 설치
nvm install --lts

# 설치 확인
node -v     # v24.16.0
npm -v      # 11.13.0
```

### 4. Docker Desktop 실행 → 백그라운드에서 항상 켜두기

---

## 🚀 프로젝트 실행 방법

### 1. 저장소 클론

```bash
cd ~
git clone 'https://github.com/2025-SMHRD-KDT-HealthCare-3/Dali.git'
cd Dali
```

### 2. 브랜치 생성 및 이동 (예.본인영문이니셜 kyh)

```bash
git checkout -b 본인 브랜치명
```

### 3. 브랜치 확인

```bash
git branch
```

### 4. VSCode로 열기

```bash
code .
```

> [중요] VSCode 왼쪽 하단에 `WSL: Ubuntu` 표시 확인 필수!!
> 뜨지 않는 경우, 상단 중앙에 '빠른 엑세스 열기' 선택 → WSL 선택

### 5. .env 파일 생성

```bash
cp .env.example .env
```

`.env` 파일을 열어서 실제 값을 입력


### 6. 실행

처음 실행 시 로그를 확인하면서 정상 동작 여부를 확인합니다.

```bash
# 처음 실행 (로그 직접 확인 권장)
docker-compose up --build
```

정상 동작 확인 후 Ctrl + C 로 중지, 백그라운드 실행으로 전환합니다.

```bash
# 백그라운드 재실행 (터미널을 다른 용도로 사용 가능)
docker-compose up -d

# 처음부터 백그라운드 실행은 아래의 명령어
docker-compose up --build -d
```

중지할 때는 아래 명령어를 사용합니다.

```bash
docker-compose down
```

### 7. 접속 주소

| 서비스 | 주소 |
|---|---|
| Frontend | http://localhost:5173 |
| Node | http://localhost:3000 |
| FastAPI | http://localhost:8000 |

---


## 🔄 자주 쓰는 명령어

```bash
docker-compose down           # 중지
docker-compose logs -f        # 전체 로그 확인
docker-compose logs -f node   # 서비스별 로그 확인
```
