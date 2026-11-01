# 커뮤니티 댓글 요약 구현 계획

## 범위와 스택
- 개드립 게시글 한 곳부터 지원한다. 첫 버전은 현재 로드된 댓글을 대상으로 한다.
- 확장기능: TypeScript + React + Vite + Manifest V3.
- 백엔드: Node.js + Fastify + TypeScript. 공통 입력·출력 검증은 Zod로 관리한다.
- LLM은 OpenAI Responses API의 gpt-6-luna, reasoning.effort=low를 사용한다.
- 백엔드는 로컬 127.0.0.1:4318에서 실행한다. API 키는 백엔드 환경변수로만 관리한다.
- 로그인, DB, 전체 댓글 자동 수집은 초기 범위에서 제외한다.

## 생성 예정 파일
```text
CommunitySummary_/
├─ PLAN.md                         # 이 계획서
├─ package.json                    # npm workspaces 및 공통 실행 명령
├─ tsconfig.base.json              # 공통 TypeScript 설정
├─ .gitignore                      # 환경변수·빌드 결과 제외
├─ README.md                       # 설치·실행·확장 로드 방법
├─ packages/
│  └─ contracts/
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ src/index.ts              # 댓글·요약 요청/응답 Zod 스키마와 타입
└─ apps/
   ├─ extension/
   │  ├─ package.json
   │  ├─ tsconfig.json
   │  ├─ vite.config.ts            # content/background 빌드 구성
   │  ├─ public/manifest.json      # 개드립 접근·백엔드 통신 권한
   │  └─ src/
   │     ├─ content.tsx            # 추출기 연결·Shadow DOM·React 마운트
   │     ├─ background.ts          # 메시지 검증·고정 백엔드 호출
   │     ├─ Dogdrip_/
   │     │  └─ Dogdrip.ts          # 제목·본문·댓글·답글 관계 추출
   │     └─ SummaryPanel_/
   │        ├─ SummaryPanel.tsx    # 버튼·로딩·결과·오류·재시도
   │        └─ styles.css          # 삽입 UI 스타일
   └─ api/
      ├─ package.json
      ├─ tsconfig.json
      ├─ .env.example             # 키 없이 필요한 환경변수 이름만 기재
      └─ src/
         ├─ server.ts             # Fastify 시작·환경설정·호출 제한
         └─ Summarize_/
            ├─ Summarize.ts       # POST /summarize 및 처리 흐름
            ├─ llm.ts             # 제공사 호출·시간 제한·출력 검증
            ├─ prompt.ts          # 반응을 1~4줄로 요약하는 지침
            └─ cache.ts           # 용량·TTL 제한 메모리 캐시
```

## 동작과 구현 순서
1. 제공받은 HTML로 댓글 선택자·답글 관계·삽입 위치를 확인한다.
2. 공통 스키마와 사이트 추출기를 작성한다. 닉네임 등 불필요한 정보는 전송하지 않는다.
3. 댓글 위에 접을 수 있는 요약 카드를 구현한다. 기능 ON·기본 펼침이며 확장 설정에서 변경한다.
4. 백엔드에 입력 길이 제한, LLM 호출, 내용 기반 캐시, 오류 응답을 연결한다.
5. 펼쳐진 카드가 화면 가까이 오면 수집 → 서비스 워커 → API → 결과 표시를 실행한다.
6. 긴 게시글용 플로팅 버튼은 기본 흐름 구현 후 추가한다. 댓글 영역이 보이면 숨긴다.

## 구현 시 유의사항
- 댓글의 명령문은 데이터로 취급한다. 다수 의견과 소수 의견을 근거 없이 단정하지 않는다.
- 캐시 키에는 입력 내용·모델·프롬프트 버전을 반영한다. 현재 캐시는 단일 사용자 로컬 서버 전용이다.
- DOM 변경 시 중복 UI를 방지한다. React는 요약 UI에만 사용하고 댓글 추출은 일반 TS로 작성한다.
- 파일은 가능한 한 150줄 이내로 유지한다. 공개 배포 전 인증·사용자별 할당량 정책을 결정한다.

## 완료 확인 항목
- 댓글 없음, 답글, 추가 로드, 중복 클릭, API 오류·시간 초과, 재시도 시 UI 동작.
- 현재 수집 범위와 표시된 댓글 수의 일치, 비밀키의 확장 번들 미포함.

## 구현 반영
- 설정 화면(options.tsx), 설정 저장(settings.ts), 요청 상태 훅(useSummary.ts)을 추가했다.
- 부모 댓글 ID는 추측하지 않고 답글 여부만 전달한다. 추가 로드된 댓글은 수동 갱신한다.
- 초기 버전은 로컬 전용이며 실제 OpenAI 응답 검증은 사용자의 키 입력 후 진행한다.
