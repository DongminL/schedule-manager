# schedule-manager

Work Schedule Management Web Service

## Tech Stack
Next.js 15 (App Router) + React 19 + TypeScript
Auth: next-auth v5
DB: Drizzle + Postgres (로컬 docker-compose, 운영 Neon)
State: zustand
Validation: zod
Test: Jest, Playwright

## Commands
- Dev:       npm run dev
- Build:     npm run build
- Lint:      npm run lint
- Typecheck: npm run typecheck
- Test:      npm test              # jest
- E2E:       npm run test:e2e      # playwright (최초 1회 npm run test:e2e:install)
- DB:        npm run db:generate | db:migrate | db:push | db:studio
- Seed:      npm run seed
- 로컬 DB:   docker compose up -d

## Notes
- E2E는 docker-compose DB가 아니라 Testcontainers로 자체 Postgres 기동 (tests/e2e/config/).
- 프로젝트 규칙: .claude/rules/{common,react,typescript}/*.md
