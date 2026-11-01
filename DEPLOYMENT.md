# GitHub 자동 배포

- 저장소: `skiende74/community-summary`, Production 브랜치: `main`
- Vercel 프로젝트: `skiende74s-projects/community-summary-api`
- Root Directory: 저장소 최상위 (`.`). `apps/api`로 변경하지 않습니다.
- 함수 진입점: `api/index.ts` → `apps/api/src/app.ts`
- 설치: `npm ci --include=dev`, 빌드: `npm run build:contracts`, 출력: `public`

`main`에 push하면 Vercel이 자동 배포합니다. 로컬 commit만으로는 배포되지 않습니다.
`scripts/vercel-ignore.mjs`가 마지막 성공 배포 이후의 변경을 비교합니다.
확장 UI·문서만 변경했으면 생략하고, API·공유 계약·의존성·배포 설정이 바뀌면 배포합니다.
첫 배포이거나 이전 커밋을 확인할 수 없을 때에는 안전하게 배포합니다.

## 환경변수

`OPENAI_API_KEY`는 기존 Vercel 프로젝트의 Production 환경변수를 사용합니다.
로컬 `.env`는 GitHub에 올리지 않습니다. 확장기능 번들에도 키를 넣지 않습니다.
Preview에는 현재 API 키가 없으므로 실제 LLM 호출은 Production에서 확인합니다.
환경변수를 바꾼 경우에는 Vercel에서 직접 재배포해야 합니다.

공용 게시판 규칙은 Upstash Redis 무료 플랜 `community-summary-rules`에 저장합니다.
유료 자동 전환은 비활성화했습니다. Vercel Marketplace가 Production에 주입하는
`KV_REST_API_URL`/`KV_REST_API_TOKEN`을 사용합니다 (`UPSTASH_REDIS_REST_*` 이름도 지원).
저장소 키는 확장기능과 GitHub에 포함하지 않습니다. 조회·저장 장애 시 기존 로컬 규칙을 유지합니다.

## 규칙 생성 제한과 관리자 인증

일반 요청은 확장 설치 ID 기준 최근 24시간 동안 총 10회, 동일 호스트당 10회로 제한합니다.
www와 m 등 하위 호스트는 별도로 계산합니다. IP 제한은 사용하지 않습니다.
Redis의 서버 시각과 원자적 스크립트로 검사·차감하며, 저장소 장애 시 생성 요청을 차단합니다.
LLM 호출 직전 차감하므로 모델 호출 실패도 횟수에 포함됩니다. 규칙 조회·적용 및 댓글 요약에는 이 한도를 적용하지 않습니다.
설치 ID는 재설치·저장소 삭제·임의 변경으로 우회 가능하며 인증이나 전체 비용 상한이 아닙니다.

서버 `ADMIN_TOKEN`에 32자 이상의 무작위 비밀값을 설정하세요. 코드나 공개 문서에 값을 넣지 않습니다.
확장 설정 하단 버전명을 5번 연속 클릭하면 관리자 토큰 입력란이 나타납니다.
서버 검증 후 해당 브라우저 `chrome.storage.local`에 저장하며, 규칙 생성 요청에만 Authorization 헤더로 전송합니다.
관리자는 규칙 생성 일일 한도만 면제됩니다. 기존 분당 요청·동시 실행 제한은 유지됩니다.
인증 해제로 로컬 토큰을 삭제할 수 있고, 서버 환경변수 교체·재배포로 이전 토큰을 무효화할 수 있습니다.
서버 배포와 확장 0.1.1 업데이트가 모두 필요합니다. 설치 ID 없는 이전 확장의 신규 규칙 생성은 거절됩니다.
이 변경에는 공용 규칙 승인 권한 변경이나 댓글 요약 사용량 제한은 포함되지 않습니다.

## 로컬 저장소 구조

현재 로컬 `CommunitySummary_`는 상위 `Playground` Git 저장소의 하위 폴더입니다.
GitHub에는 이 폴더의 내용만 저장소 최상위로 올립니다. 상위 저장소 전체를 push하지 마세요.
일반적인 `git push` 흐름으로 작업하려면 GitHub 저장소를 별도 폴더에 clone해 사용하세요.
