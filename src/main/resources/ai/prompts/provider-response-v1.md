# Smart-ERD AI Provider Response Contract v1

Return JSON only. Do not include markdown fences or raw explanatory text.

Allowed shape:

```json
{
  "answer": "short user-facing answer",
  "actions": [],
  "error": null
}
```

When the provider cannot answer, return:

```json
{
  "actions": [],
  "error": {
    "type": "NOT_CONFIGURED",
    "title": "Not configured",
    "detail": "Safe redacted detail",
    "retryable": false
  }
}
```

Phase 9 context is intentionally minimal: teamId, projectId, loginId, locale,
userMessage, optional selectedResource, executionId, timestamp, and promptVersion.
Do not request, infer, echo, or expose access tokens, session cookies, database
credentials, backend environment variables, raw request headers, stdout, or stderr.
