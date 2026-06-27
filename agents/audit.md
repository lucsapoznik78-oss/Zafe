---
description: Run Zafe agents in cycle — full audit or specific focus area
allowed-tools: Read, Glob, Grep, Bash, Agent, WebSearch, WebFetch, Write
argument-hint: "[focus area or 'all']"
---

# Zafe Agent Cycle

Orchestrator that delegates to specialized subagents and compiles results.

Zafe is a **fantasy-sport prediction platform (Lei 14.790/2023, Art. 49)**.
Events are **esporte + e-sports ONLY**. Two worlds: a PAID **Concurso**
(R$ entry → fixed R$ prize via PIX) and a FREE zone (everything else, Z$
virtual only). Golden rule: R$ is a fee and NEVER becomes Z$/ZC$.

## Agent roster (26 agents)

### Core audit (run with /audit or /audit all)
| Agent | Focus |
|-------|-------|
| zafe-qa | Bugs, TypeScript errors, broken logic |
| zafe-security | Auth, wallet exploits, PIX/payment, XSS, injection |
| zafe-db | Schema integrity, RLS, constraints |
| zafe-compliance | Lei 14.790/2023 Art. 49 (fantasy), language, esporte/e-sports scope |

### Module-specific
| Agent | Focus |
|-------|-------|
| zafe-liga | Liga module: topics, betting, odds, ranking (esporte/e-sports) |
| zafe-games | Zafe Games: e-sports bolão (free points / Z$ pot), streamer rev-share |
| zafe-privadas | Privadas: creation, acceptance, limits, payout |
| zafe-concurso | Concurso PAGO: R$ entry, scoring, fixed R$ PIX prize, Art. 49 |
| zafe-wallet | All Z$/ZC$ operations: every code path touching balances |
| zafe-odds | Dynamic odds, FIFO matching, parimutuel pools, probability snapshots |

### Infrastructure
| Agent | Focus |
|-------|-------|
| zafe-auth | Signup, login, sessions, CPF/KYC, middleware |
| zafe-admin | Admin panel, moderation, cron, seed bets, Copa/Games resolution |
| zafe-api | All API routes: auth, validation, error handling |
| zafe-deploy | Pre-deploy checklist: build, env, migrations |
| zafe-perf | Performance: queries, indexes, bundle, rendering |
| zafe-frontend | UI/UX: responsive, loading states, accessibility |
| zafe-social | Friends, referrals, sharing, community |

### Utility
| Agent | Focus |
|-------|-------|
| zafe-migration | Creates Supabase SQL migrations |
| zafe-tests | Writes tests for critical flows |
| zafe-resolver | Sports/e-sports market resolution + Copa/Games oracles |
| zafe-validity | Validates active events are still factually possible |
| zafe-crosscheck | Duplicate/overlap detection across modules |
| zafe-dates | Date coherence: market closes before the real event |
| zafe-content | Market ideas and social media copy (esporte/e-sports) |
| zafe-docs | Documentation generation and audit |
| zafe-analytics | Engagement, growth, and resolution metrics |

## Execution

### /audit or /audit all → core 4 in sequence
Phase 1: delegate to zafe-qa → "Full codebase scan for bugs and type errors"
Phase 2: delegate to zafe-security → "Full security audit"
Phase 3: delegate to zafe-db → "Database integrity check"
Phase 4: delegate to zafe-compliance → "Legal compliance scan"

### /audit [agent-name] → run one specific agent
- `qa`, `security`, `db`, `compliance`
- `liga`, `games`, `privadas`, `concurso`
- `wallet`, `odds`, `auth`, `admin`, `api`
- `deploy`, `perf`, `frontend`, `social`
- `migration`, `tests`, `resolver`, `validity`
- `crosscheck`, `dates`, `content`, `docs`, `analytics`

### /audit deep → all 10 audit agents
Runs: qa → security → db → compliance → wallet → liga → games → privadas → api → auth

### /audit fix → auto-fix mode
Applies fixes from existing AUDIT-REPORT.md

### /audit fix [N] → fix specific issue
Targets issue number N from AUDIT-REPORT.md

## Final report
Compile all findings into AUDIT-REPORT.md sorted by severity.
