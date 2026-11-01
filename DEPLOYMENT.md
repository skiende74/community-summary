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

## 로컬 저장소 구조

현재 로컬 `CommunitySummary_`는 상위 `Playground` Git 저장소의 하위 폴더입니다.
GitHub에는 이 폴더의 내용만 저장소 최상위로 올립니다. 상위 저장소 전체를 push하지 마세요.
일반적인 `git push` 흐름으로 작업하려면 GitHub 저장소를 별도 폴더에 clone해 사용하세요.
