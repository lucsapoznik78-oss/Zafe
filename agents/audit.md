---
description: Run Zafe agents in cycle — full audit or specific focus area
allowed-tools: Read, Glob, Grep, Bash, Agent, WebSearch, WebFetch, Write
argument-hint: "[focus area or 'all']"
---

# Zafe Agent Cycle

Orchestrator that delegates to specialized subagents and compiles results.

## Agent roster (20 agents)

### Core audit (run with /audit or /audit all)
| Agent | Focus |
|-------|-------|
| zafe-qa | Bugs, TypeScript errors, broken logic |
| zafe-security | Auth, wallet exploits, XSS, injection |
| zafe-db | Schema integrity, RLS, constraints |
| zafe-compliance | Lei 5.768/71, CMN 5.298, language |

### Module-specific
| Agent | Focus |
|-------|-------|
| zafe-liga | Liga module: topics, betting, odds, ranking |
| zafe-economico | Econômico: Selic/IPCA/Dólar, order book, APIs |
| zafe-privadas | Privadas: creation, acceptance, limits, payout |
| zafe-concurso | Concurso Mensal: entry, scoring, prizes, legal |
| zafe-wallet | All Z$ operations: every code path touching balances |
| zafe-odds | Dynamic odds, FIFO matching, probability snapshots |

### Infrastructure
| Agent | Focus |
|-------|-------|
| zafe-auth | Signup, login, sessions, KYC, middleware |
| zafe-admin | Admin panel, moderation, cron, seed bets |
| zafe-api | All API routes: auth, validation, error handling |
| zafe-deploy | Pre-deploy checklist: build, env, migrations |
| zafe-perf | Performance: queries, indexes, bundle, rendering |
| zafe-frontend | UI/UX: responsive, loading states, accessibility |
| zafe-social | Friends, referrals, sharing, community |

### Utility
| Agent | Focus |
|-------|-------|
| zafe-fixer | Reads AUDIT-REPORT.md and applies fixes |
| zafe-migration | Creates Supabase SQL migrations |
| zafe-tests | Writes tests for critical flows |
| zafe-resolver | 4-layer market resolution |
| zafe-content | Market ideas and social media copy |
| zafe-docs | Documentation generation and audit |

## Execution

### /audit or /audit all → core 4 in sequence
Phase 1: delegate to zafe-qa → "Full codebase scan for bugs and type errors"
Phase 2: delegate to zafe-security → "Full security audit"
Phase 3: delegate to zafe-db → "Database integrity check"
Phase 4: delegate to zafe-compliance → "Legal compliance scan"

### /audit [agent-name] → run one specific agent
- `qa`, `security`, `db`, `compliance`
- `liga`, `economico`, `privadas`, `concurso`
- `wallet`, `odds`, `auth`, `admin`, `api`
- `deploy`, `perf`, `frontend`, `social`
- `fixer`, `migration`, `tests`, `resolver`
- `content`, `docs`

### /audit deep → all 10 audit agents
Runs: qa → security → db → compliance → wallet → liga → economico → privadas → api → auth

### /audit fix → auto-fix mode
Runs zafe-fixer on existing AUDIT-REPORT.md

### /audit fix [N] → fix specific issue
Runs zafe-fixer targeting issue number N from AUDIT-REPORT.md

## Final report
Compile all findings into AUDIT-REPORT.md sorted by severity.
