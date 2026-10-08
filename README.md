# Aplikasi HC — PT Cahaya Bukit Perunggu

HR application covering Employee Management, Organizational Development, and
General Affairs for an Indonesian manufacturing company (~160 employees). See
[CLAUDE.md](CLAUDE.md) for the product scope, data model, and source-of-truth
order, and [docs/DECISIONS.md](docs/DECISIONS.md) for why the stack and
schema look the way they do.

## Getting started

```bash
npm install
npm run db:migrate   # creates dev.db and applies migrations
npm run db:seed       # loads fictional demo accounts/employees (see below)
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`, which lists
the demo accounts.

## Demo accounts

Password for all: `Demo12345!`

| Role | Login |
|---|---|
| HR Admin | `hr.admin@cbp.demo` |
| Training & Competency Admin | `training.admin@cbp.demo` |
| GA & Asset Admin | `ga.admin@cbp.demo` |
| Manager/Approver (Budi Santoso) | `budi.manager@cbp.demo` |
| Employee (Siti Rahayu) | `siti.karyawan@cbp.demo` |

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind, Prisma 7 + SQLite (dev),
NextAuth (Auth.js) v5 with a Credentials provider. See
[docs/DECISIONS.md](docs/DECISIONS.md) for the reasoning and what changes for
staging/production (Postgres instead of SQLite, in particular).

## Useful commands

```bash
npm run db:studio   # visual DB browser
npm run db:reset    # drop + recreate + reseed the dev database
npm run lint
```
