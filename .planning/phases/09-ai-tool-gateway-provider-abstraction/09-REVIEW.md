---
phase: 09-ai-tool-gateway-provider-abstraction
reviewed: 2026-06-01T08:27:49Z
depth: standard
files_reviewed: 65
files_reviewed_list:
  - client/src/api/aiProviderApi.ts
  - client/src/components/ai/AiProviderStatusBadge.tsx
  - client/src/constants/query-keys.ts
  - client/src/hooks/useAiProviderStatus.ts
  - client/src/i18n/locales/en/translation.json
  - client/src/i18n/locales/ko/translation.json
  - client/src/pages/project/ProjectsPage.tsx
  - client/src/types/ai-provider.ts
  - client/test/unit/ai-provider-status.test.ts
  - src/main/java/com/smarterd/api/ai/AiProviderController.java
  - src/main/java/com/smarterd/api/ai/dto/AiActionDraftResponse.java
  - src/main/java/com/smarterd/api/ai/dto/AiExecutionStatusResponse.java
  - src/main/java/com/smarterd/api/ai/dto/AiProviderErrorResponse.java
  - src/main/java/com/smarterd/api/ai/dto/AiProviderExecuteRequest.java
  - src/main/java/com/smarterd/api/ai/dto/AiProviderExecuteResponse.java
  - src/main/java/com/smarterd/api/ai/dto/AiProviderStatusResponse.java
  - src/main/java/com/smarterd/api/ai/dto/AiSelectedResourceRequest.java
  - src/main/java/com/smarterd/application/ai/AiExecutionAuditService.java
  - src/main/java/com/smarterd/application/ai/AiExecutionGateway.java
  - src/main/java/com/smarterd/application/ai/AiExecutionRegistry.java
  - src/main/java/com/smarterd/application/ai/AiExecutionState.java
  - src/main/java/com/smarterd/application/ai/AiSelectedResource.java
  - src/main/java/com/smarterd/application/ai/prompt/PromptTemplateLoader.java
  - src/main/java/com/smarterd/application/ai/provider/AiActionDraft.java
  - src/main/java/com/smarterd/application/ai/provider/AiActionRiskLevel.java
  - src/main/java/com/smarterd/application/ai/provider/AiProvider.java
  - src/main/java/com/smarterd/application/ai/provider/AiProviderAvailability.java
  - src/main/java/com/smarterd/application/ai/provider/AiProviderError.java
  - src/main/java/com/smarterd/application/ai/provider/AiProviderRequest.java
  - src/main/java/com/smarterd/application/ai/provider/AiProviderResult.java
  - src/main/java/com/smarterd/application/ai/provider/AiProviderStatus.java
  - src/main/java/com/smarterd/application/ai/provider/CodexAvailabilityProbe.java
  - src/main/java/com/smarterd/application/ai/provider/CodexProcessRequest.java
  - src/main/java/com/smarterd/application/ai/provider/CodexProcessResult.java
  - src/main/java/com/smarterd/application/ai/provider/CodexProcessRunner.java
  - src/main/java/com/smarterd/application/ai/provider/JavaProcessLauncher.java
  - src/main/java/com/smarterd/application/ai/provider/LocalCodexProcessProvider.java
  - src/main/java/com/smarterd/application/ai/provider/NoopAiProvider.java
  - src/main/java/com/smarterd/application/ai/provider/ProcessLauncher.java
  - src/main/java/com/smarterd/application/ai/SelectedResourceValidator.java
  - src/main/java/com/smarterd/application/ai/validation/ActionDraftValidator.java
  - src/main/java/com/smarterd/application/ai/validation/ProviderOutputValidator.java
  - src/main/java/com/smarterd/config/ai/AiProperties.java
  - src/main/java/com/smarterd/config/ai/AiProviderConfig.java
  - src/main/java/com/smarterd/domain/ai/AiExecutionAudit.java
  - src/main/java/com/smarterd/domain/ai/AiExecutionAuditRepository.java
  - src/main/java/com/smarterd/domain/common/message/MessageCode.java
  - src/main/resources/ai/prompts/codex-provider-v1.md
  - src/main/resources/ai/prompts/provider-response-v1.md
  - src/main/resources/ai/provider-output.schema.json
  - src/main/resources/application.yml
  - src/main/resources/db/migration/V20260601_01__phase9_ai_execution_audit.sql
  - src/main/resources/i18n/messages_ko.properties
  - src/main/resources/i18n/messages.properties
  - src/test/java/com/smarterd/api/ai/AiProviderControllerMvcTest.java
  - src/test/java/com/smarterd/application/ai/ActionDraftValidatorTest.java
  - src/test/java/com/smarterd/application/ai/AiExecutionAuditServiceTest.java
  - src/test/java/com/smarterd/application/ai/AiExecutionGatewayCancellationTest.java
  - src/test/java/com/smarterd/application/ai/AiExecutionGatewayTest.java
  - src/test/java/com/smarterd/application/ai/AiExecutionRegistryTest.java
  - src/test/java/com/smarterd/application/ai/provider/CodexAvailabilityProbeTest.java
  - src/test/java/com/smarterd/application/ai/provider/CodexProcessRunnerTest.java
  - src/test/java/com/smarterd/application/ai/provider/LocalCodexProcessProviderTest.java
  - src/test/java/com/smarterd/application/ai/provider/LocalCodexSmokeTest.java
  - src/test/java/com/smarterd/application/ai/ProviderOutputValidatorTest.java
findings:
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-06-01T08:27:49Z
**Depth:** standard
**Files Reviewed:** 65
**Status:** issues_found

## Summary

Reviewed the AI provider gateway implementation, frontend status surface, prompts, schema, migration, and unit tests at standard depth. The main defects are in the local Codex process boundary: untrusted user input can drive a credential-bearing local agent without output redaction, the availability probe drops `PATH`, and process I/O can deadlock before stdout is read.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Local Codex Can Be Prompt-Injected Into Leaking Local Secrets

**Severity:** BLOCKER
**File:** `src/main/java/com/smarterd/application/ai/provider/LocalCodexProcessProvider.java:69`

**Issue:** `execute()` forwards `System.getenv()` into the local Codex runner, and the runner intentionally preserves `HOME` and `CODEX_HOME` while placing the raw `userMessage` into the Codex prompt. The only guard against secret exfiltration is prompt text that says not to expose tokens or local paths, but the backend later returns any valid `answer` string after shape validation. A user can prompt-inject the local Codex process into reading files under its accessible home/Codex configuration and returning the content as a normal answer; `ProviderOutputValidator` checks length and JSON shape, not secret content or source access.

Relevant lines:
- `src/main/java/com/smarterd/application/ai/provider/LocalCodexProcessProvider.java:69` passes `System.getenv()`.
- `src/main/java/com/smarterd/application/ai/provider/CodexProcessRunner.java:17` allows `HOME` and `CODEX_HOME`.
- `src/main/java/com/smarterd/application/ai/provider/LocalCodexProcessProvider.java:106` appends the untrusted user message.
- `src/main/java/com/smarterd/application/ai/validation/ProviderOutputValidator.java:54` only runs bean validation.

**Fix:**
Run Codex with a dedicated empty temporary home and isolated Codex config for this provider, do not pass the server user's `HOME`/`CODEX_HOME`, and add deterministic redaction before returning or auditing provider text. If authentication is required, use a purpose-built service credential mounted in a minimal directory that contains no user secrets.

```java
// CodexProcessRunner
private static final Set<String> ENV_ALLOWLIST = Set.of(
    "PATH",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR"
);

// LocalCodexProcessProvider / runner setup
final var isolatedHome = Files.createTempDirectory(cwd, "home-");
final var env = filterEnvironment(request.hostEnvironment());
env.put("HOME", isolatedHome.toString());
env.put("CODEX_HOME", isolatedHome.resolve(".codex").toString());
```

Also reject answers containing known secret patterns or configured redaction tokens before `AiProviderResult` reaches the API response.

### CR-02: Availability Probe Cannot Find Default `codex` Outside System Paths

**Severity:** BLOCKER
**File:** `src/main/java/com/smarterd/application/ai/provider/CodexAvailabilityProbe.java:31`

**Issue:** The probe launches `List.of(executable, "--version")` with `Map.of()` as its environment. `JavaProcessLauncher` immediately clears the child environment before `start()`, so the probe has no `PATH`. With the default executable value `codex`, any install outside the platform fallback paths, such as npm or Homebrew locations, is reported as `CODEX_NOT_FOUND` even though the real execution path would preserve a filtered `PATH`.

**Fix:**
Probe with the same filtered host environment used for real executions, or require an absolute executable path and validate that explicitly.

```java
new ProcessLauncher.LaunchRequest(
    "codex-probe",
    List.of(executable, "--version"),
    Path.of(System.getProperty("java.io.tmpdir")),
    filterEnvironment(System.getenv()),
    "",
    Duration.ofSeconds(5)
)
```

Prefer sharing a single environment-building component between `CodexAvailabilityProbe` and `CodexProcessRunner` so status and execution cannot diverge.

### CR-03: Process Launcher Can Deadlock On stdout/stderr Before Reading Output

**Severity:** BLOCKER
**File:** `src/main/java/com/smarterd/application/ai/provider/JavaProcessLauncher.java:37`

**Issue:** The launcher writes stdin, waits for the process to exit, and only then reads stdout. It never drains stderr at all. If Codex writes enough stdout or stderr to fill the OS pipe buffer, the child blocks while Java is still waiting in `waitFor()`, so a healthy execution is converted into `TIMED_OUT` or hangs until timeout. Large JSON answers, progress output, warnings, or schema errors can all trigger this even when the provider would otherwise complete.

**Fix:**
Drain stdout and stderr concurrently while the process runs, then wait for completion. Return captured stderr in `ProcessLauncher.Result` for internal diagnostics, while keeping API-facing errors redacted.

```java
var stdoutFuture = CompletableFuture.supplyAsync(() -> readUtf8(process.getInputStream()));
var stderrFuture = CompletableFuture.supplyAsync(() -> readUtf8(process.getErrorStream()));
var finished = process.waitFor(request.timeout().toMillis(), TimeUnit.MILLISECONDS);
if (!finished) {
    process.destroyForcibly();
    return new Result(124, stdoutFuture.join(), stderrFuture.join(), true, cancelled.get());
}
return new Result(process.exitValue(), stdoutFuture.join(), stderrFuture.join(), false, cancelled.get());
```

## Warnings

### WR-01: Opt-In Smoke Test Never Exercises Codex

**Severity:** WARNING
**File:** `src/test/java/com/smarterd/application/ai/provider/LocalCodexSmokeTest.java:10`

**Issue:** The smoke test only checks the opt-in assumption and then exits. When `smart-erd.ai.codex.smoke.enabled=true`, it still performs no provider status check, no process launch, and no output validation. That creates a false positive for the exact integration path most likely to fail in production: local Codex invocation with the configured executable and schema.

**Fix:** After the assumption passes, instantiate the real local provider or at least run `CodexAvailabilityProbe.status()` and assert `AVAILABLE`; for a full smoke, execute a minimal request and assert a validated answer or a known safe provider error.

```java
assumeTrue(Boolean.getBoolean("smart-erd.ai.codex.smoke.enabled"));
var status = new CodexAvailabilityProbe("codex", new JavaProcessLauncher(), Clock.systemUTC()).status();
assertThat(status.availability()).isEqualTo(AiProviderAvailability.AVAILABLE);
```

---

_Reviewed: 2026-06-01T08:27:49Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
