# 데이터 사전 일괄 업로드 & 한글 키워드 자동 추천 — 구현 설계서

## 개요

기획서(`plan/dictionary-bulk-upload-design.md`)에서 정의한 두 가지 기능을 구현한다.
(1) 엑셀/CSV 파일로 도메인·용어를 일괄 등록하는 **일괄 업로드** — 서버 2-phase(validate → save) 패턴,
(2) 한글 키워드 입력 시 기존 사전을 기반으로 물리명/도메인을 자동 추천하는 **키워드 자동 추천** — 별도 Controller(`DictionarySuggestController`)로 분리.

기존 `ExcelUtils` 유틸리티를 엑셀 파싱/생성에 활용하고, CSV는 `BufferedReader` + split으로 처리한다.

---

## API 설계

### 신규 엔드포인트

| Method | Path | 설명 | Auth |
|--------|------|------|------|
| POST | `/api/teams/{teamId}/domains/upload/validate` | 도메인 업로드 파일 검증 | Bearer JWT |
| POST | `/api/teams/{teamId}/domains/upload` | 도메인 일괄 저장 | Bearer JWT |
| GET | `/api/teams/{teamId}/domains/upload/template` | 도메인 템플릿 다운로드 | Bearer JWT |
| POST | `/api/teams/{teamId}/terms/upload/validate` | 용어 업로드 파일 검증 | Bearer JWT |
| POST | `/api/teams/{teamId}/terms/upload` | 용어 일괄 저장 | Bearer JWT |
| GET | `/api/teams/{teamId}/terms/upload/template` | 용어 템플릿 다운로드 | Bearer JWT |
| POST | `/api/teams/{teamId}/dictionary/suggest` | 키워드 기반 물리명/도메인 추천 | Bearer JWT |

### 요청/응답 스키마

#### 1. 도메인 업로드 검증 — `POST /api/teams/{teamId}/domains/upload/validate`

- **Request**: `multipart/form-data` — `file` (MultipartFile, .xlsx 또는 .csv)
- **Response** (200):
```json
{
  "totalCount": 15,
  "validCount": 12,
  "errorCount": 3,
  "rows": [
    {
      "rowNumber": 2,
      "valid": true,
      "errors": [],
      "data": { "logicalName": "금액", "physicalType": "DECIMAL(15,2)", "description": "화폐 금액" }
    },
    {
      "rowNumber": 4,
      "valid": false,
      "errors": ["논리명은 필수입니다"],
      "data": { "logicalName": "", "physicalType": "INT", "description": null }
    }
  ]
}
```
- **에러 조건**:
  - 400: 지원하지 않는 파일 형식, 빈 파일, 500행 초과, 필수 컬럼 누락
  - 403: 팀 미소속

#### 2. 도메인 일괄 저장 — `POST /api/teams/{teamId}/domains/upload`

- **Request**:
```json
{
  "rows": [
    { "logicalName": "금액", "physicalType": "DECIMAL(15,2)", "description": "화폐 금액" },
    { "logicalName": "이름", "physicalType": "VARCHAR(50)", "description": null }
  ]
}
```
- **Response** (200):
```json
{
  "savedCount": 12,
  "failedCount": 0
}
```
- **에러 조건**:
  - 400: 빈 rows 배열
  - 403: 팀 미소속
  - 주의: 저장 중 개별 행 실패(동시 중복 등)는 failedCount에 집계, 예외를 던지지 않음

#### 3. 도메인 템플릿 다운로드 — `GET /api/teams/{teamId}/domains/upload/template`

- **Request**: 없음
- **Response**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (바이너리 .xlsx)
- 컬럼: `논리명 (필수)`, `물리 타입 (필수)`, `설명`
- 샘플 데이터 1행 포함: `금액`, `DECIMAL(15,2)`, `화폐 금액`
- **에러 조건**: 403: 팀 미소속

#### 4. 용어 업로드 검증 — `POST /api/teams/{teamId}/terms/upload/validate`

- 도메인 검증과 동일 패턴, 컬럼이 다름
- **Response** `rows[].data`:
```json
{ "logicalName": "사용자명", "physicalName": "user_name", "domainLogicalName": "이름", "description": null }
```
- 용어의 `domainLogicalName`은 서버에서 팀의 도메인 사전과 매칭하여 검증

#### 5. 용어 일괄 저장 — `POST /api/teams/{teamId}/terms/upload`

- **Request**:
```json
{
  "rows": [
    { "logicalName": "사용자명", "physicalName": "user_name", "domainLogicalName": "이름", "description": null }
  ]
}
```
- `domainLogicalName`으로 팀 내 도메인을 조회하여 `domainId`를 해결

#### 6. 용어 템플릿 다운로드 — `GET /api/teams/{teamId}/terms/upload/template`

- 컬럼: `논리명 (필수)`, `물리명 (필수)`, `도메인 (논리명)`, `설명`
- 샘플 데이터 1행: `사용자명`, `user_name`, `이름`, (빈칸)

#### 7. 키워드 추천 — `POST /api/teams/{teamId}/dictionary/suggest`

- **Request**:
```json
{ "keyword": "사용자 이름" }
```
- **Response** (200):
```json
{
  "physicalName": "user_name",
  "domainId": null,
  "domainLogicalName": null,
  "matches": [
    { "keyword": "사용자", "matched": true, "physicalName": "user", "source": "용어: 사용자 → user" },
    { "keyword": "이름", "matched": true, "physicalName": "name", "source": "용어: 이름 → name" }
  ]
}
```
- **에러 조건**: 403: 팀 미소속
- 빈 keyword(2글자 미만)는 프론트에서 필터링, 서버에서도 빈 결과 반환

---

## 데이터 모델

### 엔티티 변경 사항

**엔티티 변경 없음.** 기존 `Domain`, `Term` 엔티티를 그대로 사용한다.

### 레포지토리 추가 메서드

#### DomainRepository — 신규 메서드

```java
// 팀 내 논리명 목록으로 존재 여부 일괄 확인 (bulk 검증용)
List<Domain> findByTeamAndLogicalNameIn(Team team, Collection<String> logicalNames);

// 팀 내 논리명으로 단일 도메인 조회 (용어 업로드 시 도메인 이름→엔티티 매핑)
Optional<Domain> findByTeamAndLogicalName(Team team, String logicalName);
```

#### TermRepository — 신규 메서드

```java
// 팀 내 논리명 목록으로 존재 여부 일괄 확인 (bulk 검증용)
List<Term> findByTeamAndLogicalNameIn(Team team, Collection<String> logicalNames);
```

### DB 영향

- 새 테이블: 없음
- 기존 테이블 변경: 없음
- 인덱스: `domains(team_id, logical_name)` 복합 인덱스 추가 권장 (이미 `existsByTeamAndLogicalName` 쿼리가 있으므로 성능 향상). `ddl-auto: update`이므로 JPA 어노테이션으로 추가하거나 별도 DDL 불필요.

### 신규 DTO (Java record)

#### 일괄 업로드 공통

```java
// api/dictionary/dto/BulkValidationResponse.java
public record BulkValidationResponse(
    int totalCount,
    int validCount,
    int errorCount,
    List<BulkValidationRow> rows
) {}

// api/dictionary/dto/BulkValidationRow.java
public record BulkValidationRow(
    int rowNumber,
    boolean valid,
    List<String> errors,
    Map<String, String> data  // 범용 key-value (도메인/용어 공용)
) {}
```

#### 도메인 일괄 저장

```java
// api/dictionary/dto/BulkDomainSaveRequest.java
public record BulkDomainSaveRequest(
    @Valid @NotEmpty List<BulkDomainRow> rows
) {}

// api/dictionary/dto/BulkDomainRow.java (inner record 또는 별도 파일)
public record BulkDomainRow(
    @NotBlank String logicalName,
    @NotBlank String physicalType,
    String description
) {}
```

#### 용어 일괄 저장

```java
// api/dictionary/dto/BulkTermSaveRequest.java
public record BulkTermSaveRequest(
    @Valid @NotEmpty List<BulkTermRow> rows
) {}

// api/dictionary/dto/BulkTermRow.java
public record BulkTermRow(
    @NotBlank String logicalName,
    @NotBlank String physicalName,
    String domainLogicalName,  // nullable — 도메인 논리명으로 참조
    String description
) {}
```

#### 일괄 저장 응답

```java
// api/dictionary/dto/BulkSaveResponse.java
public record BulkSaveResponse(
    int savedCount,
    int failedCount
) {}
```

#### 키워드 추천

```java
// api/dictionary/dto/SuggestRequest.java
public record SuggestRequest(
    @NotBlank @Size(min = 2, max = 200) String keyword
) {}

// api/dictionary/dto/SuggestResponse.java
public record SuggestResponse(
    String physicalName,
    Long domainId,
    String domainLogicalName,
    List<SuggestMatch> matches
) {}

// api/dictionary/dto/SuggestMatch.java
public record SuggestMatch(
    String keyword,
    boolean matched,
    String physicalName,
    String source
) {}
```

---

## 백엔드 서비스 설계

### DomainBulkService (신규)

```
domain/dictionary/service/DomainBulkService.java
```

기존 `DomainService`에 bulk 메서드를 추가하지 않고, **별도 서비스**로 분리하여 단일 책임을 유지한다.

**주요 메서드:**

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DomainBulkService {
    private final DomainRepository domainRepository;
    private final AuthService authService;
    private final TeamService teamService;

    /** 업로드 파일에서 도메인 데이터를 파싱하고 검증한다. */
    public BulkValidationResponse validateUpload(String loginId, Long teamId, MultipartFile file);

    /** 검증 통과한 도메인을 일괄 저장한다. */
    @Transactional
    public BulkSaveResponse bulkSave(String loginId, Long teamId, BulkDomainSaveRequest request);

    /** 도메인 템플릿 엑셀을 생성한다. */
    public ExcelUtils.ExcelData generateTemplate();
}
```

**검증 로직 (validateUpload):**
1. 팀 멤버십 확인
2. 파일 확장자 확인 (.xlsx / .csv)
3. 파일 파싱: xlsx → `ExcelUtils.extractData()`, csv → `BufferedReader` + split
4. 행별 검증:
   - 논리명 필수, 100자 이내
   - 물리 타입 필수, 50자 이내
   - 설명 500자 이내
   - 파일 내 논리명 중복 체크 (Set으로 추적)
   - DB 기존 논리명 중복 체크 (`findByTeamAndLogicalNameIn` 일괄 조회)
5. `BulkValidationResponse` 반환

**CSV 파싱 전략:**
- `BufferedReader`로 줄 단위 읽기
- 첫 줄은 헤더로 건너뜀
- 각 줄을 `,` 기준 split (쉼표가 값에 포함된 경우: 큰따옴표로 감싸진 필드 처리)
- 인코딩: UTF-8 BOM 자동 감지 (`BOM \uFEFF` prefix 제거)

### TermBulkService (신규)

```
domain/dictionary/service/TermBulkService.java
```

**주요 메서드:**

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TermBulkService {
    private final TermRepository termRepository;
    private final DomainRepository domainRepository;
    private final AuthService authService;
    private final TeamService teamService;

    /** 업로드 파일에서 용어 데이터를 파싱하고 검증한다. */
    public BulkValidationResponse validateUpload(String loginId, Long teamId, MultipartFile file);

    /** 검증 통과한 용어를 일괄 저장한다. */
    @Transactional
    public BulkSaveResponse bulkSave(String loginId, Long teamId, BulkTermSaveRequest request);

    /** 용어 템플릿 엑셀을 생성한다. */
    public ExcelUtils.ExcelData generateTemplate();
}
```

**용어 검증 특이사항:**
- `domainLogicalName` → 팀의 도메인 사전에서 논리명 매칭. 없으면 에러
- `findByTeamAndLogicalNameIn`으로 기존 논리명 일괄 확인

### DictionarySuggestService (신규)

```
domain/dictionary/service/DictionarySuggestService.java
```

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DictionarySuggestService {
    private final TermRepository termRepository;
    private final DomainRepository domainRepository;
    private final AuthService authService;
    private final TeamService teamService;

    /** 한글 키워드에서 물리명과 도메인을 추천한다. */
    public SuggestResponse suggest(String loginId, Long teamId, SuggestRequest request);
}
```

**추천 로직:**
1. 팀 멤버십 확인
2. 키워드를 공백 기준으로 토큰 분리: `"사용자 이름"` → `["사용자", "이름"]`
3. 각 토큰에 대해 팀의 용어 사전 조회:
   - 완전 일치: `termRepository.findByTeamAndLogicalName(team, token)` → physicalName
   - 완전 일치 실패 시 부분 포함: `logicalName LIKE %token%` (팀 전체 목록에서 in-memory 필터링)
4. 매칭된 물리명들을 `_`로 조합 → `physicalName`
5. 키워드 전체를 도메인 사전에서 매칭: 마지막 토큰 → `domainRepository.findByTeamAndLogicalName(team, lastToken)` 또는 전체 키워드
6. 매칭 근거(`SuggestMatch` 목록) 생성

**성능 고려:**
- 팀당 용어 수가 적으므로 (수백 건 이하) `findByTeam` 전체 목록을 가져온 후 in-memory 매칭이 충분
- 도메인도 동일하게 전체 목록 in-memory 매칭

### CsvParser (유틸리티 — static 메서드)

```
utils/CsvParser.java
```

```java
public final class CsvParser {
    /** CSV 파일을 파싱하여 행별 문자열 배열을 반환한다. 첫 줄(헤더)은 제외. */
    public static List<String[]> parse(InputStream inputStream);
}
```

- BOM 처리, 쉼표 내 큰따옴표 필드 처리 포함
- 별도 라이브러리 없이 `BufferedReader` + 정규식/수동 파싱

---

## 프론트엔드 설계

### 라우팅

라우팅 변경 없음. 기존 `DictionaryPage` (`/teams/:teamId/dictionary`) 내에서 동작.

### 컴포넌트 트리

```
DictionaryPage (기존)
├── DomainTab (수정 — "업로드" 버튼 추가)
│   ├── Button (variant="outline", icon=Upload)  →  BulkUploadDialog 열기
│   └── BulkUploadDialog (신규, mode="domain")
│       ├── Step 1: FileDropzone (신규)
│       │   ├── 드래그 앤 드롭 영역
│       │   └── 템플릿 다운로드 링크
│       ├── Step 2: PreviewTable (신규)
│       │   ├── 요약 배지 (성공/오류 건수)
│       │   ├── Table (체크박스 + 데이터 + 상태)
│       │   └── 에러 안내 텍스트
│       └── Step 3: CompleteSummary (신규)
│           └── 성공 아이콘 + 결과 텍스트
│
├── TermTab (수정 — "업로드" 버튼 추가)
│   ├── Button (variant="outline", icon=Upload)  →  BulkUploadDialog 열기
│   └── BulkUploadDialog (신규, mode="term")
│
└── TermFormDialog (수정 — 키워드 추천 연동)
    └── SuggestHint (신규, 인라인)
        ├── Spinner (로딩 중)
        ├── 매칭 근거 텍스트
        └── "매칭 없음" 텍스트
```

### 상태 관리

| 상태 | 저장소 | 설명 |
|------|--------|------|
| 도메인/용어 목록 | React Query | `queryKeys.dictionary.domains(teamId)` / `.terms(teamId)` (기존) |
| 업로드 검증 결과 | useState (BulkUploadDialog 내) | `validationResult: BulkValidationResponse \| null` |
| 선택된 행 | useState (BulkUploadDialog 내) | `selectedRows: Set<number>` — rowNumber Set |
| 업로드 스텝 | useState (BulkUploadDialog 내) | `step: 1 \| 2 \| 3` |
| 선택된 파일 | useState (BulkUploadDialog 내) | `file: File \| null` |
| 키워드 추천 결과 | useState (TermFormDialog 내) | `suggestion: SuggestResponse \| null` |
| 물리명 사용자 수정 플래그 | useState (TermFormDialog 내) | `physicalNameDirty: boolean` |
| 도메인 사용자 수정 플래그 | useState (TermFormDialog 내) | `domainDirty: boolean` |

### 신규 타입 정의

```typescript
// types/dictionary.ts 에 추가

/** 일괄 업로드 검증 응답 */
export interface BulkValidationResponse {
  /** 전체 행 수 */
  totalCount: number;
  /** 유효 행 수 */
  validCount: number;
  /** 에러 행 수 */
  errorCount: number;
  /** 행별 검증 결과 */
  rows: BulkValidationRow[];
}

/** 개별 행 검증 결과 */
export interface BulkValidationRow {
  /** 엑셀 원본 행 번호 */
  rowNumber: number;
  /** 유효 여부 */
  valid: boolean;
  /** 에러 메시지 목록 */
  errors: string[];
  /** 파싱된 데이터 (key-value) */
  data: Record<string, string>;
}

/** 일괄 저장 응답 */
export interface BulkSaveResponse {
  /** 저장 성공 건수 */
  savedCount: number;
  /** 저장 실패 건수 */
  failedCount: number;
}

/** 키워드 추천 요청 */
export interface SuggestRequest {
  /** 한글 키워드 */
  keyword: string;
}

/** 키워드 추천 응답 */
export interface SuggestResponse {
  /** 추천 물리명 */
  physicalName: string | null;
  /** 추천 도메인 ID */
  domainId: number | null;
  /** 추천 도메인 논리명 */
  domainLogicalName: string | null;
  /** 매칭 상세 */
  matches: SuggestMatch[];
}

/** 개별 매칭 정보 */
export interface SuggestMatch {
  /** 입력 토큰 */
  keyword: string;
  /** 매칭 성공 여부 */
  matched: boolean;
  /** 매칭된 물리명 */
  physicalName: string | null;
  /** 매칭 출처 설명 */
  source: string | null;
}
```

### 신규 API 모듈 함수

#### domainApi.ts — 추가

```typescript
/** 도메인 업로드 파일을 검증한다. */
export async function validateDomainUpload(teamId: string, file: File): Promise<BulkValidationResponse>;

/** 검증 통과한 도메인을 일괄 저장한다. */
export async function bulkSaveDomains(teamId: string, rows: DomainFormData[]): Promise<BulkSaveResponse>;

/** 도메인 템플릿 엑셀을 다운로드한다. */
export async function downloadDomainTemplate(teamId: string): Promise<void>;
```

#### termApi.ts — 추가

```typescript
/** 용어 업로드 파일을 검증한다. */
export async function validateTermUpload(teamId: string, file: File): Promise<BulkValidationResponse>;

/** 검증 통과한 용어를 일괄 저장한다. */
export async function bulkSaveTerms(teamId: string, rows: BulkTermRow[]): Promise<BulkSaveResponse>;

/** 용어 템플릿 엑셀을 다운로드한다. */
export async function downloadTermTemplate(teamId: string): Promise<void>;
```

#### suggestApi.ts (신규)

```typescript
/** 키워드 기반 물리명/도메인 추천을 요청한다. */
export async function fetchSuggestion(teamId: string, keyword: string): Promise<SuggestResponse>;
```

### 신규 커스텀 훅

#### useDictionarySuggest.ts (신규)

```typescript
/**
 * 한글 키워드에서 물리명/도메인을 추천하는 debounce 훅.
 *
 * @param teamId 팀 ID
 * @param keyword 입력 키워드
 * @param enabled 활성화 여부 (2글자 이상)
 * @returns { suggestion, isLoading }
 */
export function useDictionarySuggest(teamId: string, keyword: string, enabled: boolean);
```

- 내부적으로 `useQuery` + `keepPreviousData` 옵션 사용
- queryKey: `queryKeys.dictionary.suggest(teamId, debouncedKeyword)`
- debounce 300ms (useMemo + setTimeout 또는 별도 debounce 유틸)

### queryKeys 확장

```typescript
dictionary: {
  domains: (teamId: string) => ['teams', teamId, 'domains'] as const,
  terms: (teamId: string) => ['teams', teamId, 'terms'] as const,
  // 신규
  suggest: (teamId: string, keyword: string) => ['teams', teamId, 'dictionary', 'suggest', keyword] as const,
},
```

---

## i18n 메시지 코드 (백엔드)

### MessageCode enum 추가

```java
// 일괄 업로드 검증 에러
ERROR_BULK_UNSUPPORTED_FORMAT("error.bulk.unsupported-format"),
ERROR_BULK_EMPTY_FILE("error.bulk.empty-file"),
ERROR_BULK_TOO_MANY_ROWS("error.bulk.too-many-rows"),
ERROR_BULK_MISSING_COLUMNS("error.bulk.missing-columns"),
```

### messages.properties 추가

```properties
# === Bulk Upload ===
error.bulk.unsupported-format=Unsupported file format. Only .xlsx and .csv are supported
error.bulk.empty-file=File contains no data
error.bulk.too-many-rows=Maximum {0} rows can be uploaded
error.bulk.missing-columns=Required columns are missing: {0}
```

### messages_ko.properties 추가

```properties
# === Bulk Upload ===
error.bulk.unsupported-format=\uc9c0\uc6d0\ud558\uc9c0 \uc54a\ub294 \ud30c\uc77c \ud615\uc2dd\uc785\ub2c8\ub2e4. .xlsx\uc640 .csv\ub9cc \uc9c0\uc6d0\ud569\ub2c8\ub2e4
error.bulk.empty-file=\ud30c\uc77c\uc5d0 \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4
error.bulk.too-many-rows=\ucd5c\ub300 {0}\ud589\uae4c\uc9c0 \uc5c5\ub85c\ub4dc\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4
error.bulk.missing-columns=\ud544\uc218 \ucee8\ub7fc\uc774 \ub204\ub77d\ub418\uc5c8\uc2b5\ub2c8\ub2e4: {0}
```

---

## 파일 배치 계획

### 생성할 파일

| 파일 경로 | 담당 | 설명 |
|-----------|------|------|
| `src/main/java/com/smarterd/api/dictionary/dto/BulkValidationResponse.java` | be-developer | 검증 결과 응답 record |
| `src/main/java/com/smarterd/api/dictionary/dto/BulkValidationRow.java` | be-developer | 개별 행 검증 결과 record |
| `src/main/java/com/smarterd/api/dictionary/dto/BulkDomainSaveRequest.java` | be-developer | 도메인 일괄 저장 요청 record |
| `src/main/java/com/smarterd/api/dictionary/dto/BulkDomainRow.java` | be-developer | 도메인 행 데이터 record |
| `src/main/java/com/smarterd/api/dictionary/dto/BulkTermSaveRequest.java` | be-developer | 용어 일괄 저장 요청 record |
| `src/main/java/com/smarterd/api/dictionary/dto/BulkTermRow.java` | be-developer | 용어 행 데이터 record |
| `src/main/java/com/smarterd/api/dictionary/dto/BulkSaveResponse.java` | be-developer | 일괄 저장 응답 record |
| `src/main/java/com/smarterd/api/dictionary/dto/SuggestRequest.java` | be-developer | 추천 요청 record |
| `src/main/java/com/smarterd/api/dictionary/dto/SuggestResponse.java` | be-developer | 추천 응답 record |
| `src/main/java/com/smarterd/api/dictionary/dto/SuggestMatch.java` | be-developer | 추천 매칭 결과 record |
| `src/main/java/com/smarterd/api/dictionary/DictionarySuggestController.java` | be-developer | 키워드 추천 Controller |
| `src/main/java/com/smarterd/domain/dictionary/service/DomainBulkService.java` | be-developer | 도메인 일괄 업로드 서비스 |
| `src/main/java/com/smarterd/domain/dictionary/service/TermBulkService.java` | be-developer | 용어 일괄 업로드 서비스 |
| `src/main/java/com/smarterd/domain/dictionary/service/DictionarySuggestService.java` | be-developer | 키워드 추천 서비스 |
| `src/main/java/com/smarterd/utils/CsvParser.java` | be-developer | CSV 파싱 유틸리티 |
| `client/src/components/dictionary/BulkUploadDialog.tsx` | fe-developer | 3-step 업로드 다이얼로그 |
| `client/src/api/suggestApi.ts` | fe-developer | 추천 API 모듈 |
| `client/src/hooks/useDictionarySuggest.ts` | fe-developer | 키워드 추천 debounce 훅 |

### 수정할 파일

| 파일 경로 | 담당 | 변경 내용 |
|-----------|------|-----------|
| `src/main/java/com/smarterd/api/dictionary/DomainController.java` | be-developer | upload/validate, upload, upload/template 3개 엔드포인트 추가 |
| `src/main/java/com/smarterd/api/dictionary/TermController.java` | be-developer | upload/validate, upload, upload/template 3개 엔드포인트 추가 |
| `src/main/java/com/smarterd/domain/dictionary/repository/DomainRepository.java` | be-developer | `findByTeamAndLogicalNameIn`, `findByTeamAndLogicalName` 추가 |
| `src/main/java/com/smarterd/domain/dictionary/repository/TermRepository.java` | be-developer | `findByTeamAndLogicalNameIn` 추가 |
| `src/main/java/com/smarterd/domain/common/message/MessageCode.java` | be-developer | 일괄 업로드 에러 코드 4개 추가 |
| `src/main/resources/i18n/messages.properties` | be-developer | 일괄 업로드 에러 메시지 4개 추가 |
| `src/main/resources/i18n/messages_ko.properties` | be-developer | 일괄 업로드 에러 메시지 4개 추가 |
| `client/src/api/domainApi.ts` | fe-developer | `validateDomainUpload`, `bulkSaveDomains`, `downloadDomainTemplate` 추가 |
| `client/src/api/termApi.ts` | fe-developer | `validateTermUpload`, `bulkSaveTerms`, `downloadTermTemplate` 추가 |
| `client/src/types/dictionary.ts` | fe-developer | 6개 인터페이스 추가 |
| `client/src/constants/query-keys.ts` | fe-developer | `suggest` 키 추가 |
| `client/src/components/dictionary/DomainTab.tsx` | fe-developer | "업로드" 버튼 + BulkUploadDialog 연동 |
| `client/src/components/dictionary/TermTab.tsx` | fe-developer | "업로드" 버튼 + BulkUploadDialog 연동 |
| `client/src/components/dictionary/TermFormDialog.tsx` | fe-developer | 키워드 추천 연동 (useDictionarySuggest, 자동 채움, 추천 힌트) |
| `client/src/i18n/locales/ko/translation.json` | fe-developer | 일괄 업로드 + 추천 i18n 키 추가 |
| `client/src/i18n/locales/en/translation.json` | fe-developer | 일괄 업로드 + 추천 i18n 키 추가 |

---

## 태스크 분해

### Phase 1: 기반 작업 (병렬)

| # | 태스크 | 담당 | 의존 | 상세 |
|---|--------|------|------|------|
| 1 | DTO record 생성 + Repository 메서드 추가 + MessageCode/messages 추가 + CsvParser 유틸 | be-developer | - | BulkValidationResponse, BulkValidationRow, BulkDomainSaveRequest, BulkDomainRow, BulkTermSaveRequest, BulkTermRow, BulkSaveResponse, SuggestRequest, SuggestResponse, SuggestMatch record 생성. DomainRepository/TermRepository에 `findByTeamAndLogicalNameIn`, `findByTeamAndLogicalName` 추가. MessageCode enum에 4개 코드 추가. messages.properties / messages_ko.properties에 메시지 추가. CsvParser 유틸 생성. |
| 2 | 타입 정의 + API 모듈 + queryKeys + i18n 키 | fe-developer | - | types/dictionary.ts에 6개 인터페이스 추가. domainApi.ts에 3개 함수, termApi.ts에 3개 함수, suggestApi.ts 신규 생성. queryKeys에 suggest 키 추가. ko/en translation.json에 i18n 키 추가 (기획서 i18n 키 전체). |

### Phase 2: 서비스 + 컨트롤러 / 컴포넌트 (병렬, Phase 1 후)

| # | 태스크 | 담당 | 의존 | 상세 |
|---|--------|------|------|------|
| 3 | DomainBulkService + TermBulkService + DictionarySuggestService + Controller 엔드포인트 | be-developer | #1 | DomainBulkService (validateUpload, bulkSave, generateTemplate), TermBulkService (validateUpload, bulkSave, generateTemplate), DictionarySuggestService (suggest) 구현. DomainController에 3개 엔드포인트, TermController에 3개 엔드포인트, DictionarySuggestController 신규 생성. |
| 4 | BulkUploadDialog + DomainTab/TermTab 수정 + useDictionarySuggest + TermFormDialog 추천 연동 | fe-developer | #2 | BulkUploadDialog.tsx (3-step, 도메인/용어 모드 공용), DomainTab/TermTab에 "업로드" 버튼 추가, useDictionarySuggest.ts 훅 생성, TermFormDialog에 추천 연동 (자동 채움 + 힌트). |

### Phase 3: 리뷰

| # | 태스크 | 담당 | 의존 | 상세 |
|---|--------|------|------|------|
| 5 | 통합 코드 리뷰 | reviewer | #3, #4 | 전체 코드 리뷰 (아키텍처 정합성, 보안, 성능, 컨벤션) |

---

## 리스크 및 고려사항

### 성능
- **대량 업로드 시 DB 중복 체크**: `findByTeamAndLogicalNameIn`으로 한 번에 조회하여 N+1 방지. 500행 제한이므로 단일 쿼리로 충분.
- **일괄 저장**: `saveAll()` 사용. 500건 이하이므로 batch insert로 충분.
- **추천 API**: 팀당 사전 규모가 작으므로 (수백 건) `findByTeam` 전체 조회 후 in-memory 매칭이 적절. 추후 규모가 커지면 QueryDSL LIKE 쿼리로 전환 가능.

### 보안
- **파일 업로드 크기 제한**: Spring Boot 기본 `spring.servlet.multipart.max-file-size: 5MB` 설정 필요 (application.yml)
- **파일 형식 검증**: 확장자뿐 아니라 실제 Content-Type도 체크 (xlsx: `application/vnd.openxmlformats...`, csv: `text/csv`)
- **팀 멤버십 검증**: 모든 엔드포인트에서 기존 패턴 동일하게 `verifyMembership` 호출

### CSV 인코딩
- UTF-8 BOM (`\uFEFF`) 자동 감지 및 제거
- BOM 없는 UTF-8이 기본
- EUC-KR 자동 감지는 복잡도 대비 효용이 낮으므로, UTF-8만 지원하되 에러 메시지에 UTF-8 인코딩 안내 표시

### Multipart 설정
- `application.yml`에 추가:
```yaml
spring:
  servlet:
    multipart:
      max-file-size: 5MB
      max-request-size: 5MB
```

### 기존 코드와의 호환성
- 기존 `DomainService`, `TermService`는 수정하지 않음 (새 Bulk 서비스로 분리)
- 기존 단건 CRUD API는 변경 없음
- `ExcelUtils`는 기존 코드 그대로 사용 (엑셀 파싱에 `extractData`, 생성에 `toExcel` + `download`)
