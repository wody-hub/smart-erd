# Saved ERD Performance Attribution Implementation Plan

> **For agentic workers:** Execute this plan task by task. The designated executor is Luna; report each stage to the owner for review.

**Goal:** Attribute the 8.6–9.0 second main-thread tail observed when opening a representative saved ERD, without modifying the original data.

**Architecture:** Make an isolated clone of the existing PostgreSQL database; run separate backend and browser sessions against that clone. Add an opt-in, low-overhead browser probe with phase spans and aggregate counters. Capture repeated baseline runs and separate CPU traces, then run a minimally invasive edge-detour A/B only if the baseline is valid.

**Tech Stack:** PostgreSQL 17, Spring Boot, Vite/React, Yjs, ReactFlow, Playwright, Chrome CDP.

## Global constraints

- Supply the selected source team, project, and diagram IDs through environment variables. Before cloning, verify the row identity in the database. No browser or backend benchmark may connect to the original DB/backend after isolation begins.
- The original database row must have matching pre/post hashes for full row, content, and Y.Doc snapshot. Do not assume navigation is write-free: dictionary reconciliation can write system-origin changes.
- Keep dumps, traces, and raw payloads outside the repository in a `umask 077` temporary directory. Reports contain only sizes, timing, counts, and sanitized stack names. Never output credentials or snapshot content.
- Every valid run starts from the same cloned seed DB, including A/B variants. Verify JDBC URL, HTTP proxy, and `VITE_WS_DIRECT_BASE_URL` point to the cloned backend. The frontend test mode uses a direct WebSocket URL.
- Production comparison means production frontend bundle with test backend/auth; do not call it a production deployment.
- Probe and diagnostic routing variant must be disabled in normal builds and URLs. Do not change persisted routing type, saved data format, autosave behavior, or application functionality.
- Reuse the same Chrome version, viewport 1440×900, DPR 1, no CPU/network throttling, fresh context per run, same login and page state. Record fallback/reconnect/errors and exclude invalid runs with reasons.

## Task 1: Reproducible isolated fixture

**Files:** Create `scripts/perf/saved-erd-isolation.sh` (or a comparably focused runner helper); document usage in the final report.

**Interface:** Inputs: original compose/PostgreSQL target, unique clone container/port, private output directory. Outputs: source dump path, seed DB, per-run DB creation command, original-before hash, connection manifest. Fail on occupied ports/names; never delete an existing DB/container.

- [ ] Confirm original diagram identity and capture `md5(to_jsonb(d)::text)`, `md5(content)`, `md5(ydoc_snapshot)`, sizes, revisions, and timestamp into a private file.
- [ ] `pg_dump --format=custom --no-owner --no-acl` the current DB and restore to a new local PostgreSQL 17 container on a new loopback port. Keep a seed DB untouched by the app.
- [ ] Before each sample, create a unique run DB from the seed; start a dedicated test-profile backend against that DB. Validate the effective JDBC target and verify both HTTP and direct WS destination use it. Do not reuse the original 9501/9502 backends.
- [ ] Verify clone row hashes equal source hashes before the first run. Stop if they differ. Repeat original hash after all experiments; report any mismatch without automatically restoring anything.
- [ ] Verify one cloned login/diagram navigation and run DB creation/teardown. Confirm graph identity before collecting performance data.

## Task 2: Opt-in measurement contract

**Files:** Create `client/src/lib/erd-performance-probe.ts`; modify only necessary entry points in `client/src/collaboration/channel/diagram/diagram-preview-hydration-controller.ts`, `client/src/collaboration/YjsProvider.ts`, `client/src/stores/canvas/canvasSyncActions.ts`, `client/src/collaboration/channel/diagram/use-diagram-collaboration-store-bridge.ts`, `client/src/pages/diagram/DiagramPage.tsx`, `client/src/components/erd/ERDCanvas.tsx`, `client/src/components/erd/TableNode.tsx`, `client/src/components/erd/ErdRelationEdge.tsx`, and `client/src/hooks/useDiagramDictionaryReconciliation.ts`. Adjust exact files to actual owners in source.

**Interface:** Probe emits navigation-relative spans/counters with run ID, lifecycle ID, sequence, phase, entity counts and durations; no payloads. Expose a final snapshot to the runner. Activate only with `VITE_ERD_PERF_PROBE=true` plus an `addInitScript` browser option. Keep per-edge/per-node hot paths to aggregate counters instead of marks or console logging.

- [ ] Mark preview load start/end, preview unlock reason, WS open/sync, snapshot message bytes, merge/apply start/end, projection request/full-or-scoped/convert/set times, React commit, node-internals queue/flush, obstacle selector and detour routing aggregate time/calls, dictionary plan/apply/no-op, and JS errors.
- [ ] Distinguish preview store-ready, preview commit, and a two-rAF presentation proxy from live data-ready, live commit, and live settled. `live-ready` must use order-independent conditions: remote snapshot applied, sync true, WS connected, preview released. Do not equate existing console logs with paint. Settled requires expected graph count, drained internals queue, no relevant projection/route/geometry changes and no 50ms long task for 500ms; impose a 30s timeout.
- [ ] Count mount/unmount and StrictMode lifecycle IDs. `Y.applyUpdate` duration is inclusive of synchronous observers and projection; do not label it decoding self-time. Internals flush is not the same as ReactFlow's later DOM measurement.
- [ ] Verify probe-off has no emitted marks/global snapshot and existing behavior unchanged. If readiness logic is a pure helper, test WS-first, snapshot-first, and fallback orders.

## Task 3: Browser runner and baseline attribution

**Files:** Create `client/scripts/perf/saved-erd-benchmark.mjs`; write sanitized summary and machine-readable aggregate JSON to a private output directory. Keep raw CDP trace outside the repo.

**Interface:** CLI accepts base URL, team/project/diagram IDs, variant, warmup/samples, output directory, and a per-sample lifecycle command. It fails if any network request or WebSocket targets the original backend. Record HTTP status/timing, WS frame type/size, probe snapshot, Long Tasks, rAF gaps, graph counts, and errors. Never save response bodies or authentication material.

- [ ] Add `PerformanceObserver({type:'longtask',buffered:true})` before navigation. Record each task and `sum(max(duration-50,0))` as blocking excess, distinct from Lighthouse TBT.
- [ ] Run dev baseline with 1 warmup + 5 valid independent clone runs; run production-frontend baseline with the same. Capture one separate CDP CPU trace per build using `Tracing.start` with `devtools.timeline`, `v8`, `blink.user_timing`, CPU profiler, and screenshots, `transferMode: ReturnAsStream`. Trace runs do not enter timing statistics.
- [ ] Validate production frontend preview API proxy and direct WS before samples. For production build, use `npm run build -- --mode frontend-test --sourcemap`; serve with `vite preview` on a separate port. Record frontend build hash, browser version, backend hash, DB row hashes, and machine conditions.
- [ ] In a dev diagnostic trace, optionally use React Profiler around DiagramPage/ERDCanvas. Standard production React does not expose equivalent profiling timing; do not compare its values as production CPU or paint.
- [ ] Report all raw per-run values plus median/min/max/IQR, preview-vs-live intervals, long-task start/end and blocking excess. Do not make p95 claims from five samples. Use browser CPU call tree/bottom-up to classify largest tasks as JS scripting, style/layout, paint, GC, Yjs inclusive, projection, React, routing, or unknown. Do not sum nested inclusive spans.

## Task 4: Minimal causal A/B and conclusion

**Files:** Keep diagnostic branch in `client/src/components/erd/ErdRelationEdge.tsx` and runner; extend attribution report.

- [ ] Compare production-frontend baseline and `route-detour-off` in 5 paired, alternating clone runs. The variant skips only `buildObstacleAvoidingAutoRoute` and falls into the existing smoothstep fallback; keep obstacle selector, edge count, node geometry, handles, dictionary, and persisted routing type. Record visible graph equivalence.
- [ ] Consider the detour contribution meaningful only if live-settled or blocking-excess median improves by at least 20% and 200ms, 4/5 pairs move in the same direction, and CPU trace supports the mechanism. This is an exploratory threshold, not statistical proof.
- [ ] If the A/B is inconclusive, select the single strongest trace-driven follow-up: selector-off, edge-display-off, 6→24 internals batch, dictionary apply-off on clone, isolated Y.Doc apply without observers, preview mount comparison, or dev StrictMode comparison. State why that one discriminates the observed hotspot. Do not run all variants by default.
- [ ] Report proven bottleneck(s), rejected hypotheses, unknown time, confounders, and concrete next optimization target. Include clone/source hash equality and the exact verification commands/results. Do not claim root cause if trace coverage or live-ready validity is insufficient.
- [ ] Run `cd client && npx tsc -b`, ESLint/Prettier on changed files, probe-on dev/prod smoke, and probe-off behavior check. Inspect `git diff --check` and `git status --short`.

## Review gate

Owner reviews Task 1 isolation before the first browser run, Task 2 measurement semantics before aggregating timing, and Task 3 baseline validity before accepting the A/B. The owner may request a bounded correction when evidence reveals a flaw. No source optimization is part of this measurement plan.

## Execution outcome (2026-10-13)

The isolated clone, opt-in probe, production-frontend baseline (one warmup plus five valid runs), source-mapped CPU trace, and five paired detour-off comparisons were completed. The two warmed development attempts followed preview fallback, so the planned development remote-preview baseline and dev trace were not pooled or claimed. The production A/B identified obstacle-avoiding detour routing as a major contributor; exact per-update rerender triggers remain unproven. The original and clone-seed row hashes matched before and after; no per-run databases remain. Detailed measurements and limitations remain in a local, ignored benchmark report.
