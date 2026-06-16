# TDD Plan: application-riskzero-si-review

## RED Cases

| ID | Area | Test File | Expected RED |
|----|------|-----------|--------------|
| APP-RED-1 | Transaction boundary | `src/test/java/com/smarterd/application/ai/AiExecutionGatewayTest.java` | `execute` still has method-level `@Transactional` |
| APP-RED-2 | Process IO | `src/test/java/com/smarterd/application/ai/provider/JavaProcessLauncherTest.java` | process times out or loses stderr because streams are not drained concurrently |
| APP-RED-3 | String utilities | `src/test/java/com/smarterd/application/ApplicationStandardsTest.java` | direct string normalization pattern exists in application code |
| APP-RED-4 | Transaction convention | `src/test/java/com/smarterd/application/ApplicationStandardsTest.java` | AI service misses read-only class default or write override |
| APP-RED-5 | Class size | `src/test/java/com/smarterd/application/ApplicationStandardsTest.java` | one or more application classes exceed the line-count threshold |

## GREEN Verification

- Re-run each focused RED command after the minimal implementation.
- Compile backend Java sources and tests.
- Run application standards plus affected AI service/controller tests.
- Run backend documentation and string-utility convention checks.

## Commands

```bash
./gradlew test --tests '*AiExecutionGatewayTest.executeIsNotTransactionalSoProviderRunStaysOutsideDatabaseTransaction'
./gradlew test --tests '*JavaProcessLauncherTest.launchDrainsStdoutAndStderrWhileProcessIsRunning'
./gradlew test --tests '*ApplicationStandardsTest'
./gradlew compileJava compileTestJava
./scripts/check-string-utils.sh
node scripts/verify-function-docs.mjs --backend-only
```
