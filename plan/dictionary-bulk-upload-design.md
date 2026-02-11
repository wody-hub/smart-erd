# 데이터 사전 일괄 업로드 & 한글 키워드 자동 추천 기획서

## 개요

데이터 사전(도메인/용어) 관리의 생산성을 높이기 위한 두 가지 기능을 추가한다.
(1) 엑셀/CSV 파일로 도메인·용어를 한번에 대량 등록하는 **일괄 업로드** 기능,
(2) 한글 키워드 입력 시 기존 용어·도메인 사전을 기반으로 물리명/물리타입을 자동 조합·추천하는 **키워드 자동 추천** 기능.

---

## 사용자 스토리

### 기능 1: 일괄 업로드

- [ ] US-1: 팀 멤버로서, 도메인 사전 데이터를 엑셀(.xlsx) 또는 CSV 파일로 한번에 등록하기 위해, "업로드" 버튼을 클릭하여 파일을 선택할 수 있다
- [ ] US-2: 팀 멤버로서, 업로드 전에 파일 내용을 미리보기하고 유효성 검증 결과(중복, 필수값 누락 등)를 확인하기 위해, 검증 결과가 포함된 미리보기 화면을 볼 수 있다
- [ ] US-3: 팀 멤버로서, 검증 통과한 행만 선택적으로 저장하기 위해, 에러 행을 제외하고 유효한 행만 일괄 저장할 수 있다
- [ ] US-4: 팀 멤버로서, 용어 사전 데이터를 엑셀(.xlsx) 또는 CSV 파일로 한번에 등록하기 위해, "업로드" 버튼을 클릭하여 파일을 선택할 수 있다
- [ ] US-5: 팀 멤버로서, 업로드할 파일의 올바른 형식을 알기 위해, 템플릿 파일을 다운로드할 수 있다

### 기능 2: 한글 키워드 자동 추천

- [ ] US-6: 팀 멤버로서, 용어 사전에 새 항목을 등록할 때 한글 키워드를 입력하면 물리명을 자동 추천받기 위해, 논리명 필드에 "사용자 이름"을 입력하면 `user_name`이 추천된다
- [ ] US-7: 팀 멤버로서, 한글 키워드에 매칭되는 도메인(물리 타입)이 있으면 자동으로 연결되기 위해, "금액" 키워드에 `DECIMAL(15,2)` 도메인이 추천된다
- [ ] US-8: 팀 멤버로서, 복합 키워드("사용자 이름")의 각 단어를 기존 용어 사전에서 개별 매칭하여 물리명을 조합하기 위해, "사용자"→`user`, "이름"→`name` → `user_name`이 자동 생성된다

---

## 화면 흐름

### 기능 1: 일괄 업로드 흐름

```
DictionaryPage
  ├── DomainTab
  │   ├── [도메인 추가] 버튼 (기존)
  │   ├── [업로드] 버튼 (신규)  ─── 클릭 ───▶ BulkUploadDialog (도메인 모드)
  │   │                                         ├── Step 1: 파일 선택 + 템플릿 다운로드
  │   │                                         ├── Step 2: 미리보기 + 검증 결과
  │   │                                         └── Step 3: 저장 완료 결과
  │   └── 도메인 테이블 (기존)
  │
  └── TermTab
      ├── [용어 추가] 버튼 (기존)
      ├── [업로드] 버튼 (신규)  ─── 클릭 ───▶ BulkUploadDialog (용어 모드)
      │                                         ├── Step 1: 파일 선택 + 템플릿 다운로드
      │                                         ├── Step 2: 미리보기 + 검증 결과
      │                                         └── Step 3: 저장 완료 결과
      └── 용어 테이블 (기존)
```

### 기능 2: 한글 키워드 자동 추천 흐름

```
TermFormDialog (생성/수정)
  └── 논리명(logicalName) 입력 필드
        │
        │ (입력 후 포커스 이동 또는 debounce 300ms)
        ▼
      서버 API 호출: POST /api/teams/{teamId}/dictionary/suggest
        │
        ▼
      추천 결과 표시
        ├── 물리명(physicalName) 자동 채움 (빈 경우에만)
        ├── 도메인(domain) 자동 선택 (빈 경우에만)
        └── 추천 근거 툴팁 표시 (어떤 용어/도메인에서 매칭되었는지)
```

---

## 화면 상세

### 화면 1: DomainTab / TermTab — 업로드 버튼 추가

- **진입점**: 기존 데이터 사전 페이지 (DictionaryPage)의 각 탭
- **변경 사항**: 기존 "도메인 추가" / "용어 추가" 버튼 옆에 "업로드" 버튼 추가

- **레이아웃**:
```
┌────────────────────────────────────────────┐
│ [업로드]                   [도메인 추가]    │  ◀ 버튼 영역 (flex justify-end gap-2)
├────────────────────────────────────────────┤
│ 논리명     │ 물리 타입    │ 설명    │ 작업 │  ◀ 기존 테이블 (변경 없음)
│ ...        │ ...          │ ...     │ ...  │
└────────────────────────────────────────────┘
```

- **컴포넌트 목록**:
  - `Button` (variant="outline") — 업로드 버튼 (아이콘: `Upload`)
  - 기존 `Button` (variant="default") — 생성 버튼 (변경 없음)

- **인터랙션**:
  | 액션 | 결과 | 비고 |
  |------|------|------|
  | "업로드" 버튼 클릭 | BulkUploadDialog 열기 | 도메인/용어 모드 구분 prop 전달 |

---

### 화면 2: BulkUploadDialog — Step 1 (파일 선택)

- **진입점**: DomainTab 또는 TermTab의 "업로드" 버튼 클릭
- **레이아웃**:
```
┌─────────────────────────────────────────────┐
│ ● 도메인 일괄 업로드                    [X] │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│  │                                     │   │
│  │    📄 파일을 드래그하거나            │   │
│  │       클릭하여 선택하세요            │   │
│  │                                     │   │
│  │    .xlsx, .csv 지원                  │   │
│  │                                     │   │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                             │
│  📥 템플릿 다운로드                          │
│                                             │
├─────────────────────────────────────────────┤
│                        [취소]    [다음]     │
└─────────────────────────────────────────────┘
```

- **컴포넌트 목록**:
  - `Dialog` / `DialogContent` (sm:max-w-[600px])
  - 파일 드롭존 영역 (border-dashed, border-2, rounded-lg)
  - `<input type="file" accept=".xlsx,.csv">` (hidden, 드롭존 클릭 시 트리거)
  - "템플릿 다운로드" 링크 (`Button` variant="link")
  - 하단 `DialogFooter`: 취소, 다음 버튼

- **인터랙션**:
  | 액션 | 결과 | 비고 |
  |------|------|------|
  | 파일 드래그 앤 드롭 | 파일 선택 완료, 파일명 표시 | accept: .xlsx, .csv |
  | 드롭존 클릭 | 파일 탐색기 열기 | hidden input 트리거 |
  | "템플릿 다운로드" 클릭 | 엑셀 템플릿 파일 다운로드 | GET API → blob 다운로드 |
  | "다음" 클릭 | 서버에 파일 전송 → 검증 → Step 2 | 파일 미선택 시 버튼 비활성화 |
  | "취소" 클릭 | 다이얼로그 닫기 | — |

---

### 화면 3: BulkUploadDialog — Step 2 (미리보기 + 검증)

- **진입점**: Step 1에서 "다음" 클릭 후 서버 검증 완료
- **레이아웃**:
```
┌──────────────────────────────────────────────────┐
│ ● 도메인 일괄 업로드 — 미리보기              [X] │
├──────────────────────────────────────────────────┤
│                                                  │
│  ✅ 성공 12건  ❌ 오류 3건  (총 15건)             │
│                                                  │
│  ┌──┬────┬──────────┬────────────┬──────┬──────┐ │
│  │  │ 행 │ 논리명   │ 물리 타입  │ 설명 │ 상태 │ │
│  ├──┼────┼──────────┼────────────┼──────┼──────┤ │
│  │✓ │  2 │ 금액     │ DECIMAL..  │      │  ✅  │ │
│  │✓ │  3 │ 이름     │ VARCHAR..  │      │  ✅  │ │
│  │  │  4 │ (빈칸)   │ INT        │      │  ❌  │ │
│  │  │    │          │            │필수값 │누락  │ │
│  │✓ │  5 │ 코드     │ CHAR(10)   │      │  ✅  │ │
│  │  │  6 │ 금액     │ NUMERIC..  │      │  ⚠️  │ │
│  │  │    │          │            │중복   │논리명│ │
│  └──┴────┴──────────┴────────────┴──────┴──────┘ │
│                                                  │
│  ⚠️ 오류가 있는 행은 저장에서 제외됩니다.         │
│                                                  │
├──────────────────────────────────────────────────┤
│              [이전]    [취소]    [저장 (12건)]    │
└──────────────────────────────────────────────────┘
```

- **컴포넌트 목록**:
  - `Dialog` / `DialogContent` (sm:max-w-[700px])
  - 요약 배지: 성공/오류 건수 (`Badge` 또는 inline span)
  - 미리보기 테이블 (`Table` 컴포넌트)
    - 체크박스 컬럼: 유효한 행 선택/해제
    - 행 번호 컬럼: 엑셀 원본 행 번호
    - 데이터 컬럼들: 도메인(논리명, 물리타입, 설명) 또는 용어(논리명, 물리명, 도메인, 설명)
    - 상태 컬럼: ✅ 성공 / ❌ 에러 (에러 메시지 포함)
  - 에러 행은 `bg-destructive/10` 배경 + 에러 메시지 인라인 표시
  - 중복 행은 `bg-yellow-50 dark:bg-yellow-900/10` 배경
  - 하단 `DialogFooter`: 이전, 취소, 저장 버튼

- **인터랙션**:
  | 액션 | 결과 | 비고 |
  |------|------|------|
  | 체크박스 토글 | 해당 행 저장 대상 포함/제외 | 에러 행은 체크 불가 |
  | "저장 (N건)" 클릭 | 선택된 유효 행을 서버에 일괄 저장 | Step 3으로 이동 |
  | "이전" 클릭 | Step 1로 돌아감 | 파일 재선택 가능 |
  | "취소" 클릭 | 다이얼로그 닫기 | — |

- **검증 규칙 (서버)**:

  **도메인:**
  | 항목 | 규칙 | 에러 메시지 |
  |------|------|-------------|
  | 논리명 | 필수, 100자 이내 | "논리명은 필수입니다" / "100자를 초과할 수 없습니다" |
  | 물리 타입 | 필수, 50자 이내 | "물리 타입은 필수입니다" / "50자를 초과할 수 없습니다" |
  | 설명 | 선택, 500자 이내 | "500자를 초과할 수 없습니다" |
  | 논리명 중복 | 파일 내 중복 + DB 기존 중복 | "이미 등록된 논리명입니다" / "파일 내 중복 논리명입니다" |

  **용어:**
  | 항목 | 규칙 | 에러 메시지 |
  |------|------|-------------|
  | 논리명 | 필수, 100자 이내 | "논리명은 필수입니다" |
  | 물리명 | 필수, 100자 이내 | "물리명은 필수입니다" |
  | 도메인 | 선택, 존재하는 논리명 참조 | "해당 도메인이 존재하지 않습니다" |
  | 설명 | 선택, 500자 이내 | "500자를 초과할 수 없습니다" |
  | 논리명 중복 | 파일 내 중복 + DB 기존 중복 | "이미 등록된 논리명입니다" |

---

### 화면 4: BulkUploadDialog — Step 3 (저장 완료)

- **진입점**: Step 2에서 "저장" 클릭 후 서버 저장 완료
- **레이아웃**:
```
┌──────────────────────────────────────────────┐
│ ● 도메인 일괄 업로드 — 완료              [X] │
├──────────────────────────────────────────────┤
│                                              │
│              ✅                               │
│                                              │
│     12건이 성공적으로 등록되었습니다.          │
│                                              │
│     (3건은 오류로 제외되었습니다.)             │
│                                              │
├──────────────────────────────────────────────┤
│                              [닫기]          │
└──────────────────────────────────────────────┘
```

- **컴포넌트 목록**:
  - `Dialog` / `DialogContent` (sm:max-w-[425px])
  - 성공 아이콘 (CheckCircle2, `text-green-500` — 예외적으로 시맨틱 토큰이 없으므로 허용)
  - 결과 요약 텍스트
  - "닫기" 버튼

- **인터랙션**:
  | 액션 | 결과 | 비고 |
  |------|------|------|
  | "닫기" 클릭 | 다이얼로그 닫기 + 목록 새로고침 | invalidateQueries 호출 |

---

### 화면 5: TermFormDialog — 한글 키워드 자동 추천

- **진입점**: 기존 TermFormDialog (용어 생성/수정 다이얼로그)
- **변경 사항**: 논리명 입력 시 추천 결과를 물리명/도메인에 자동 반영

- **레이아웃**:
```
┌─────────────────────────────────────────────┐
│ ● 용어 추가                             [X] │
├─────────────────────────────────────────────┤
│                                             │
│  논리명                                     │
│  ┌─────────────────────────────────────┐    │
│  │ 사용자 이름                         │    │
│  └─────────────────────────────────────┘    │
│  💡 추천: "사용자"→user, "이름"→name        │
│                                             │
│  물리명                                     │
│  ┌─────────────────────────────────────┐    │
│  │ user_name          [자동 채움 ✨]    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  도메인                                     │
│  ┌─────────────────────────────────────┐    │
│  │ 이름 (VARCHAR(50))  [자동 선택 ✨]   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  설명                                       │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
├─────────────────────────────────────────────┤
│                        [취소]    [생성]     │
└─────────────────────────────────────────────┘
```

- **컴포넌트 목록**:
  - 기존 `TermFormDialog` (수정)
  - 추천 힌트 영역: 논리명 입력 필드 아래 `text-muted-foreground text-xs` 텍스트
  - Lightbulb 아이콘 (`lucide-react`)

- **인터랙션**:
  | 액션 | 결과 | 비고 |
  |------|------|------|
  | 논리명 입력 후 blur 또는 debounce 300ms | 서버에 추천 요청 | 2글자 이상일 때만 |
  | 추천 결과 수신 (물리명) | 물리명 필드가 빈 경우 자동 채움 | 이미 입력된 경우 채우지 않음 |
  | 추천 결과 수신 (도메인) | 도메인 Select가 "없음"인 경우 자동 선택 | 이미 선택된 경우 변경하지 않음 |
  | 추천 근거 표시 | 논리명 아래 작은 텍스트로 매칭 근거 | "사용자"→user, "이름"→name |
  | 사용자가 수동으로 물리명 수정 | 추천값 무시, 수동 입력 우선 | dirty 플래그로 관리 |

- **추천 로직 (서버)**:
  1. 입력된 한글 키워드를 공백 기준으로 토큰 분리: "사용자 이름" → ["사용자", "이름"]
  2. 각 토큰을 팀의 용어 사전(Term)에서 `logicalName` 매칭
     - 완전 일치: "사용자" → Term(logicalName="사용자", physicalName="user")
     - 부분 포함: "사용자명" → Term(logicalName="사용자명", physicalName="user_name") — 완전 일치가 없을 때만
  3. 매칭된 물리명들을 `_`로 조합: `user` + `name` → `user_name`
  4. 입력 키워드 전체를 도메인 사전(Domain)에서 `logicalName` 매칭
     - "금액" → Domain(logicalName="금액", physicalType="DECIMAL(15,2)")
     - 매칭되면 해당 도메인 ID를 추천
  5. 응답: `{ physicalName: "user_name", domainId: null, matches: [...] }`

---

## 상태별 UI

### 일괄 업로드

| 상태 | 표시 내용 |
|------|-----------|
| 로딩 (파일 검증 중) | Spinner + "파일 검증 중..." 텍스트 |
| 로딩 (저장 중) | "저장" 버튼 disabled + "처리 중..." 텍스트 |
| 빈 상태 (Step 1) | 파일 드롭존 + 안내 텍스트 |
| 에러 (파일 형식 오류) | toast.error("지원하지 않는 파일 형식입니다") |
| 에러 (파일 크기 초과) | toast.error("파일 크기가 제한을 초과합니다 (최대 5MB)") |
| 에러 (빈 파일) | toast.error("파일에 데이터가 없습니다") |
| 에러 (서버 오류) | toast.error(getErrorMessage(err, t('...'))) |
| 성공 (저장 완료) | Step 3 완료 화면 + 목록 새로고침 |

### 키워드 자동 추천

| 상태 | 표시 내용 |
|------|-----------|
| 로딩 (추천 요청 중) | 논리명 필드 아래 작은 Spinner |
| 추천 결과 있음 | 매칭 근거 텍스트 + 물리명/도메인 자동 채움 |
| 추천 결과 없음 | "매칭되는 용어가 없습니다" (text-muted-foreground) |
| 에러 | 조용히 무시 (추천은 부가 기능이므로 에러 표시 안 함) |

---

## 엣지 케이스

### 일괄 업로드

- **빈 파일**: 헤더만 있고 데이터 행이 없는 경우 → "파일에 데이터가 없습니다" 에러
- **잘못된 컬럼 구조**: 필수 컬럼이 없는 경우 → "필수 컬럼(논리명, 물리 타입)이 누락되었습니다" 에러
- **대량 데이터**: 최대 500행 제한, 초과 시 → "최대 500행까지 업로드할 수 있습니다" 에러
- **파일 크기**: 최대 5MB 제한 (프론트엔드에서 1차 검증)
- **동일 파일 내 중복**: 같은 논리명이 파일 내에 여러 번 → 첫 번째 행만 유효, 이후 행은 "파일 내 중복" 에러
- **DB 기존 데이터와 중복**: 이미 등록된 논리명 → "이미 등록된 논리명입니다" 에러
- **CSV 인코딩**: UTF-8 BOM, UTF-8, EUC-KR 순으로 시도 (서버에서 자동 감지)
- **용어 업로드 시 도메인 참조**: 도메인 컬럼에 논리명을 입력 → 해당 팀의 도메인 사전에서 매칭. 없으면 에러
- **권한**: VIEWER 역할은 업로드 불가 → 서버에서 팀 멤버십 검증 (기존 패턴과 동일)
- **모든 행이 에러**: 저장 가능한 행이 0건이면 "저장" 버튼 비활성화

### 키워드 자동 추천

- **매칭 실패**: 등록된 용어가 없거나 매칭 불가 → 빈 추천 결과 반환, 사용자 수동 입력
- **부분 매칭**: "사용자 이름"에서 "사용자"만 매칭되고 "이름"은 미매칭 → `user` 만 추천, 미매칭 토큰은 원문 그대로 표시
- **수정 모드**: 기존 값이 있는 수정 모드에서는 추천으로 기존값을 덮어쓰지 않음
- **빈 입력**: 2글자 미만 입력 시 추천 요청 안 함
- **빠른 연속 입력**: debounce 300ms로 불필요한 API 호출 방지
- **네트워크 오류**: 추천 실패 시 조용히 무시 (필수 기능이 아님)

---

## i18n 키

### 일괄 업로드

| 키 | 한글 | 영어 |
|----|------|------|
| `dictionary.upload.button` | 업로드 | Upload |
| `dictionary.upload.dialogTitle.domain` | 도메인 일괄 업로드 | Bulk Upload Domains |
| `dictionary.upload.dialogTitle.term` | 용어 일괄 업로드 | Bulk Upload Terms |
| `dictionary.upload.dropzone.title` | 파일을 드래그하거나 클릭하여 선택하세요 | Drag and drop or click to select a file |
| `dictionary.upload.dropzone.formats` | .xlsx, .csv 지원 | Supports .xlsx, .csv |
| `dictionary.upload.dropzone.selected` | 선택됨: {{fileName}} | Selected: {{fileName}} |
| `dictionary.upload.template` | 템플릿 다운로드 | Download Template |
| `dictionary.upload.preview.title` | 미리보기 | Preview |
| `dictionary.upload.preview.summary` | 성공 {{success}}건, 오류 {{error}}건 (총 {{total}}건) | {{success}} valid, {{error}} errors ({{total}} total) |
| `dictionary.upload.preview.row` | 행 | Row |
| `dictionary.upload.preview.status` | 상태 | Status |
| `dictionary.upload.preview.errorNote` | 오류가 있는 행은 저장에서 제외됩니다. | Rows with errors will be excluded from saving. |
| `dictionary.upload.save` | 저장 ({{count}}건) | Save ({{count}}) |
| `dictionary.upload.complete.title` | 업로드 완료 | Upload Complete |
| `dictionary.upload.complete.success` | {{count}}건이 성공적으로 등록되었습니다. | {{count}} items successfully registered. |
| `dictionary.upload.complete.excluded` | {{count}}건은 오류로 제외되었습니다. | {{count}} items were excluded due to errors. |
| `dictionary.upload.toast.success` | 일괄 업로드가 완료되었습니다 | Bulk upload completed |
| `dictionary.upload.toast.failed` | 일괄 업로드에 실패했습니다 | Bulk upload failed |
| `dictionary.upload.error.unsupportedFormat` | 지원하지 않는 파일 형식입니다 | Unsupported file format |
| `dictionary.upload.error.fileTooLarge` | 파일 크기가 제한을 초과합니다 (최대 5MB) | File size exceeds limit (max 5MB) |
| `dictionary.upload.error.emptyFile` | 파일에 데이터가 없습니다 | File contains no data |
| `dictionary.upload.error.tooManyRows` | 최대 {{max}}행까지 업로드할 수 있습니다 | Maximum {{max}} rows can be uploaded |
| `dictionary.upload.error.missingColumns` | 필수 컬럼이 누락되었습니다 | Required columns are missing |
| `dictionary.upload.error.requiredField` | 필수값 누락 | Required field missing |
| `dictionary.upload.error.tooLong` | {{max}}자를 초과할 수 없습니다 | Cannot exceed {{max}} characters |
| `dictionary.upload.error.duplicateInFile` | 파일 내 중복 논리명 | Duplicate logical name in file |
| `dictionary.upload.error.duplicateInDb` | 이미 등록된 논리명 | Logical name already exists |
| `dictionary.upload.error.domainNotFound` | 해당 도메인이 존재하지 않습니다 | Domain not found |
| `dictionary.upload.validating` | 파일 검증 중... | Validating file... |
| `dictionary.upload.aria.dropzone` | 파일 업로드 영역 | File upload area |
| `dictionary.upload.aria.selectRow` | 행 {{row}} 선택 | Select row {{row}} |
| `common.button.next` | 다음 | Next |
| `common.button.previous` | 이전 | Previous |
| `common.button.close` | 닫기 | Close |

### 키워드 자동 추천

| 키 | 한글 | 영어 |
|----|------|------|
| `dictionary.suggest.hint` | 💡 추천: {{details}} | 💡 Suggestion: {{details}} |
| `dictionary.suggest.noMatch` | 매칭되는 용어가 없습니다 | No matching terms found |
| `dictionary.suggest.matchDetail` | "{{keyword}}"→{{physical}} | "{{keyword}}"→{{physical}} |
| `dictionary.suggest.autoFilled` | 자동 채움 | Auto-filled |

---

## API 요구사항 (구현 설계자에게 전달)

### 일괄 업로드 API

| Method | Path | 설명 | Request | Response |
|--------|------|------|---------|----------|
| POST | `/api/teams/{teamId}/domains/upload/validate` | 도메인 업로드 파일 검증 | `multipart/form-data` (file) | `BulkValidationResponse` |
| POST | `/api/teams/{teamId}/domains/upload` | 도메인 일괄 저장 | `BulkSaveRequest` | `BulkSaveResponse` |
| GET | `/api/teams/{teamId}/domains/upload/template` | 도메인 템플릿 다운로드 | — | `.xlsx` blob |
| POST | `/api/teams/{teamId}/terms/upload/validate` | 용어 업로드 파일 검증 | `multipart/form-data` (file) | `BulkValidationResponse` |
| POST | `/api/teams/{teamId}/terms/upload` | 용어 일괄 저장 | `BulkSaveRequest` | `BulkSaveResponse` |
| GET | `/api/teams/{teamId}/terms/upload/template` | 용어 템플릿 다운로드 | — | `.xlsx` blob |

#### BulkValidationResponse

```typescript
interface BulkValidationResponse {
  totalCount: number;
  validCount: number;
  errorCount: number;
  rows: BulkValidationRow[];
}

interface BulkValidationRow {
  rowNumber: number;           // 엑셀 원본 행 번호
  valid: boolean;              // 유효 여부
  errors: string[];            // 에러 메시지 목록
  data: DomainFormData | TermFormData;  // 파싱된 데이터
}
```

#### BulkSaveRequest

```typescript
interface BulkSaveRequest {
  rows: (DomainFormData | TermFormData)[];  // 저장할 유효 데이터 목록
}
```

#### BulkSaveResponse

```typescript
interface BulkSaveResponse {
  savedCount: number;          // 실제 저장된 건수
  failedCount: number;         // 저장 실패 건수 (동시 수정 등)
}
```

### 키워드 자동 추천 API

| Method | Path | 설명 | Request | Response |
|--------|------|------|---------|----------|
| POST | `/api/teams/{teamId}/dictionary/suggest` | 키워드 기반 추천 | `SuggestRequest` | `SuggestResponse` |

#### SuggestRequest / SuggestResponse

```typescript
interface SuggestRequest {
  keyword: string;  // 한글 키워드 (예: "사용자 이름")
}

interface SuggestResponse {
  physicalName: string | null;    // 추천 물리명 (예: "user_name")
  domainId: number | null;        // 추천 도메인 ID
  domainLogicalName: string | null; // 추천 도메인 논리명
  matches: SuggestMatch[];        // 매칭 상세
}

interface SuggestMatch {
  keyword: string;    // 입력 토큰 (예: "사용자")
  matched: boolean;   // 매칭 성공 여부
  physicalName: string | null;  // 매칭된 물리명 (예: "user")
  source: string | null;       // 매칭 출처 (예: "용어: 사용자 → user")
}
```

### 엑셀 템플릿 컬럼 구조

**도메인 템플릿 (.xlsx)**:

| 논리명 (필수) | 물리 타입 (필수) | 설명 |
|--------------|-----------------|------|
| 금액 | DECIMAL(15,2) | 화폐 금액 |
| 이름 | VARCHAR(50) | |

**용어 템플릿 (.xlsx)**:

| 논리명 (필수) | 물리명 (필수) | 도메인 (논리명) | 설명 |
|--------------|-------------|----------------|------|
| 사용자명 | user_name | 이름 | |
| 주문금액 | order_amount | 금액 | |

### 참고: 기존 인프라

- **ExcelUtils** (`src/main/java/com/smarterd/utils/ExcelUtils.java`): Apache POI 기반 엑셀 읽기/쓰기 유틸리티가 이미 존재함. `extractData()` 메서드로 업로드 파일 파싱, `toExcel()` + `download()`로 템플릿 다운로드에 활용 가능.
- **Apache POI**: `poi-ooxml:5.4.1` 이미 `build.gradle`에 포함됨.
- **CSV 파싱**: 별도 라이브러리(예: `OpenCSV` 또는 `Apache Commons CSV`) 추가 필요, 또는 단순 CSV는 `BufferedReader` + split으로 처리 가능.

---

## 신규 컴포넌트 구조 (프론트엔드)

```text
client/src/
├── api/
│   ├── domainApi.ts          # + uploadDomains, validateDomainUpload, downloadDomainTemplate
│   └── termApi.ts            # + uploadTerms, validateTermUpload, downloadTermTemplate
├── components/dictionary/
│   ├── BulkUploadDialog.tsx  # (신규) 3-step 업로드 다이얼로그 (도메인/용어 모드 공용)
│   ├── DomainTab.tsx         # (수정) "업로드" 버튼 추가
│   └── TermTab.tsx           # (수정) "업로드" 버튼 추가, TermFormDialog에 추천 연동
├── hooks/
│   └── useDictionarySuggest.ts  # (신규) 키워드 추천 debounce hook
└── types/
    └── dictionary.ts         # + BulkValidationResponse, SuggestResponse 등 타입 추가
```

---

## 신규 컴포넌트 구조 (백엔드)

```text
src/main/java/com/smarterd/
├── api/dictionary/
│   ├── DomainController.java         # (수정) + upload, validate, template 엔드포인트
│   ├── TermController.java           # (수정) + upload, validate, template 엔드포인트
│   ├── DictionarySuggestController.java  # (신규) 키워드 추천 엔드포인트
│   └── dto/
│       ├── BulkValidationResponse.java   # (신규) 검증 결과 응답
│       ├── BulkSaveRequest.java          # (신규) 일괄 저장 요청
│       ├── BulkSaveResponse.java         # (신규) 일괄 저장 응답
│       ├── SuggestRequest.java           # (신규) 추천 요청
│       └── SuggestResponse.java          # (신규) 추천 응답
└── domain/dictionary/
    └── service/
        ├── DomainService.java            # (수정) + bulkValidate, bulkSave 메서드
        ├── TermService.java              # (수정) + bulkValidate, bulkSave 메서드
        └── DictionarySuggestService.java # (신규) 키워드 추천 로직
```
