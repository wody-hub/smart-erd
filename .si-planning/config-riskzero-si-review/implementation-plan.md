# Implementation Plan: config-riskzero-si-review

## Status

- Status: implemented
- Scope: `src/main/java/com/smarterd/config`
- Review source: riskzero-si-review findings for configuration layer
- Research: skipped - security/configuration convention remediation only

## Review Findings

### BE-1. Production profile allowed the default JWT secret

- `JwtProperties.validateSecret` only logged a warning when production profiles used `DEV_DEFAULT_SECRET`.
- README states production must replace the default secret through `SMART_ERD_JWT_SECRET`.
- The application should fail fast before serving traffic with the development signing key.

### BE-2. CORS allowed credentials with wildcard origins

- `CorsConfig` accepted `allowCredentials=true` with `allowedOrigins=["*"]`.
- That combination violates browser CORS constraints and can create unsafe deployment drift.
- The configuration layer should reject it at startup.

### BE-3. AI provider schema path assumed exploded classpath files

- `AiProviderConfig.resolveSchemaPath` used `ClassPathResource#getFile`.
- In executable JAR packaging, classpath resources are not ordinary files and schema validation could be disabled.
- The schema resource should be copied to a temporary readable file before passing a path to the process runner.

### BE-4. Direct case-insensitive string comparison remained in config

- `AiProviderConfig` used direct `String#equalsIgnoreCase`.
- README directs common string handling through `AppStringUtils`.

## Tasks

- Add RED tests for production default JWT secret rejection.
- Add RED tests for CORS credentials plus wildcard origin rejection.
- Add RED tests for JAR-backed AI schema resource resolution.
- Implement fail-fast JWT secret validation for production profiles.
- Implement CORS wildcard/credentials validation using `AppStringUtils` normalization.
- Copy AI schema classpath resource to a temp file and use `AppStringUtils.equalsIgnoreCase`.
- Re-run config-focused tests and README-backed convention checks.

## Completion Criteria

- RED tests fail before implementation for each reviewed risk.
- GREEN tests pass after implementation.
- Config-focused regression tests pass.
- Java compile passes.
- README-backed string utility and Javadoc/order checks pass.
