import { spawnSync } from 'node:child_process';

// 첫 Git 배포이거나 비교할 커밋이 없으면 배포한다. 0은 생략, 1은 배포다.
const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
if (!previous) process.exit(1);
const paths = ['api', 'apps/api', 'packages/contracts', 'public', 'package.json', 'package-lock.json',
  'apps/extension/package.json', 'tsconfig.base.json', 'vercel.json', '.vercelignore', '.npmrc',
  '.nvmrc', '.node-version', 'scripts/vercel-ignore.mjs'];
const result = spawnSync('git', ['diff', '--quiet', previous, 'HEAD', '--', ...paths], { stdio: 'ignore' });
process.exit(result.status === 0 ? 0 : 1);
