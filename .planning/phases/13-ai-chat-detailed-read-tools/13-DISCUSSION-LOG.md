# Phase 13: AI Chat Detailed Read Tools - Discussion Log

**Date:** 2026-06-04
**Mode:** Automatic recommended path

## User Problem

The user asked whether AI chat can find related APIs and retrieve detailed project data. Current behavior could answer from high-level summaries but could not identify detailed WBS, issue, TODO, milestone, or history rows.

## Decision Summary

- Use backend-controlled detailed read context rather than allowing AI to call APIs directly.
- Reuse existing authorized domain services.
- Preserve Phase 10 member TODO aggregate-only privacy decision.
- Implement the minimal safe slice now: richer read rows in provider context.
- Document full two-pass ReadPlan/tool-loop as a future extension, not as the first implementation.

## Agent Input

- Codebase explorer confirmed `AiReadContextService` discarded row DTOs and kept only counts for WBS/issues/milestones/TODO/history.
- AI researcher recommended a backend allowlist read-tool approach, prompt-injection guardrails, caps, and eval checks.
