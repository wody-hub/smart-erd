# TDD Plan: config-riskzero-si-review

## RED Cases

| ID | Area | Test File | Expected RED |
|----|------|-----------|--------------|
| CFG-RED-1 | JWT secret safety | `src/test/java/com/smarterd/config/security/JwtPropertiesTest.java` | production profile still allows `DEV_DEFAULT_SECRET` |
| CFG-RED-2 | CORS safety | `src/test/java/com/smarterd/config/security/CorsConfigTest.java` | credentials plus wildcard origin is accepted |
| CFG-RED-3 | AI schema packaging | `src/test/java/com/smarterd/config/ai/AiProviderConfigTest.java` | JAR-backed schema classpath resource resolves to `null` |

## GREEN Verification

- Re-run each focused RED command after minimal implementation.
- Run all `com.smarterd.config.*` tests.
- Compile backend Java sources and tests.
- Run backend documentation and string-utility convention checks.
- Run the full Gradle test suite before completion.

## Commands

```bash
./gradlew test --tests '*CorsConfigTest' --tests '*JwtPropertiesTest'
./gradlew test --tests '*AiProviderConfigTest'
./gradlew test --tests 'com.smarterd.config.*'
./gradlew compileJava compileTestJava
./scripts/check-string-utils.sh
node scripts/verify-function-docs.mjs --backend-only
./gradlew test --rerun-tasks
```
