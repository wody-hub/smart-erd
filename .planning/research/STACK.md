# Stack Research

**Domain:** SI 프로젝트 관리 기능 (WBS, 마일스톤, 간트, 자원/비용 관리, 보고서)
**Researched:** 2026-04-02
**Confidence:** MEDIUM-HIGH

> 이 문서는 기존 스택 위에 추가되는 라이브러리만 다룬다. 기존 스택(Spring Boot 3.5.11 / Java 25, React 19, PostgreSQL 17, Yjs, Apache POI 5.4.1)은 이미 고정되어 있다.

---

## 기존 스택 현황 (변경 없음)

현재 `build.gradle`과 `client/package.json`에 이미 존재하는 라이브러리:

| 영역 | 이미 있음 |
|------|----------|
| 백엔드 엑셀 | `apache poi-ooxml:5.4.1` — XLSX 읽기/쓰기 완비 |
| 프론트 DnD | `@dnd-kit/core:^6.3.1`, `@dnd-kit/sortable:^10.0.0` — WBS 트리 재정렬에 재사용 가능 |
| 프론트 테이블 | `@tanstack/react-query:^5.x` — 서버 상태 관리 완비 |
| 프론트 PDF | `jspdf:^4.1.0` — 클라이언트 PDF 이미 존재 |
| 수치 포맷 | 없음 — 추가 필요 |
| 간트 차트 | 없음 — 추가 필요 |
| 트리 테이블 | 없음 — 추가 필요 |
| 서버 PDF | 없음 — 추가 필요 |

---

## Recommended Stack

### 핵심 추가 라이브러리

| 기술 | 버전 | 목적 | 선택 이유 |
|------|------|------|----------|
| `@svar-ui/react-gantt` | 2.6.1 | 간트 차트 시각화 | MIT 오픈소스, React 19 공식 지원, TypeScript, 의존성 드래그, 계층 구조, 10k 태스크 성능 검증. 무료 버전에 WBS 연동에 필요한 핵심 기능(의존성, 드래그, 필터) 포함. Frappe Gantt 대비 React 19 네이티브이며 더 많은 기능 제공. 상용 라이선스 없이 사용 가능 — HIGH confidence |
| `@tanstack/react-table` | 8.21.3 | WBS 계층형 그리드 | 이미 React Query(TanStack 생태계)를 사용 중. v8은 `getSubRows` + `getExpandedRowModel`로 트리 테이블 공식 지원. 헤드리스라 기존 shadcn/ui 스타일과 충돌 없음 — HIGH confidence |
| `recharts` | 3.8.1 | 인력/비용 차트 (파이, 라인, 바) | React 19 완전 지원 확인. SVG 기반으로 Electron/웹 호환. 번들 크기 허용 범위 (~200KB). 프로젝트 대시보드의 진척률/비용 차트에 충분 — HIGH confidence |
| `react-number-format` | 5.x | 통화/숫자 입력 포맷 | 인력 단가(M/M 단가), 비용(예산/실적) 입력 시 천 단위 구분자, 원화/달러 포맷 필요. 경량, 타입 지원, 활발히 유지 — MEDIUM confidence |
| `com.github.librepdf:openpdf` | 3.0.3 | 서버 PDF 보고서 생성 | LGPL/MPL 라이선스 — AGPL인 iText 7 대비 상업적 사용 제약 없음. 월간/주간 보고서처럼 서버에서 집계 데이터를 포함한 PDF 생성 필요. Spring Boot 통합 단순. — MEDIUM confidence |

### 지원 라이브러리

| 라이브러리 | 버전 | 목적 | 사용 조건 |
|-----------|------|------|----------|
| `date-fns` | 4.x | 날짜 계산 (M/M 환산, 마일스톤 D-day) | Gantt, WBS 날짜 조작 전반에 필요. dayjs 대비 트리셰이킹 우위 |
| `@radix-ui/react-progress` | 1.x | 진척률 프로그레스 바 UI | 이미 Radix UI를 사용 중이므로 추가 버전 충돌 없음. WBS 태스크 진척률 인라인 표시용 |
| `@radix-ui/react-slider` | 1.x | 진척률 슬라이더 입력 | WBS 태스크 진척률 직접 조작 (클릭→드래그) |

### 백엔드 추가 의존성

| 의존성 | 버전 | 목적 | 사용 조건 |
|--------|------|------|----------|
| `com.github.librepdf:openpdf` | 3.0.3 | PDF 보고서 (월간/주간) | 보고서 출력 기능 구현 시 |
| `org.apache.poi:poi-ooxml` | 5.4.1 | XLSX 보고서, 인력 계획 가져오기 | 이미 존재 — 추가 불필요 |

---

## 개별 선택 근거 (상세)

### 간트 차트: `@svar-ui/react-gantt` 선택

**경쟁 평가:**

| 라이브러리 | 라이선스 | React 19 | 가격 | 판단 |
|-----------|---------|----------|------|------|
| `@svar-ui/react-gantt` | MIT | 공식 지원 | 무료 (PRO 별도) | **선택** |
| `frappe-gantt` | MIT | 래퍼만 존재, 커뮤니티 미유지 | 무료 | 미선택 — React 네이티브 아님 |
| `Bryntum Gantt` | 상용 | 공식 지원 | $940/개발자 | 미선택 — 1인 사이드 프로젝트에 과도 |
| `DHTMLX Gantt` | 무료/상용 | 래퍼 방식 | $699부터 | 미선택 — GPL 무료버전 기능 제한 |
| `Syncfusion Gantt` | 상용 | 공식 지원 | 상용 | 미선택 — 비용 |

SVAR Gantt 무료 버전에서 이 프로젝트에 필요한 기능이 모두 포함된다:
- 계층 태스크 (WBS 연동)
- 태스크 간 의존성 시각화 (Finish-to-Start)
- 드래그로 기간 조정
- 타임라인 줌 (일/주/월)
- 태스크 필터링
- TypeScript 완전 지원

PRO 기능 중 자동 스케줄링, 기준선(baseline), Critical Path는 v2에서는 불필요하며 향후 PRO 업그레이드 경로 존재.

**React 19 호환성:** v2.3 릴리즈 노트에서 React 19 공식 지원 명시 확인. — HIGH confidence

### WBS 트리 테이블: `@tanstack/react-table` 선택

WBS는 본질적으로 "계층 데이터를 가진 인터랙티브 테이블"이다. TanStack Table v8은:
- `getSubRows` 옵션으로 중첩 데이터 구조 네이티브 지원
- `getExpandedRowModel`로 접기/펼치기
- 헤드리스 — 기존 shadcn/ui 테이블 스타일 그대로 사용 가능
- 이미 `@tanstack/react-query`를 쓰므로 생태계 일관성 유지
- 행 드래그 정렬은 기존 `@dnd-kit` 연동으로 가능 (별도 DnD 라이브러리 불필요)

직접 `<table>` + `getSubRows`로 구현해도 되지만, 정렬/필터/페이지네이션을 나중에 붙일 때 TanStack Table이 공짜로 제공한다.

### 차트: `recharts` 선택

SI 프로젝트 관리에 필요한 차트:
- 월별 인력 투입 추이 (라인)
- 예산 대비 실적 비교 (바)
- 비용 항목 구성 (파이/도넛)
- 마일스톤 달성률 (레이디얼)

Recharts는 이 모든 타입을 지원하며, SVG 기반이라 Electron/웹 렌더링 모두 안전하다. Chart.js(react-chartjs-2) 대비 React 컴포넌트 API가 더 자연스럽고, D3 직접 사용 대비 구현 비용이 낮다. 번들 크기 ~200KB는 이미 Monaco, Yjs, XYFlow를 포함한 프로젝트에서 허용 가능.

### PDF: `openpdf:3.0.3` 선택

클라이언트 PDF(`jspdf`)와 서버 PDF(`openpdf`)를 분리한다:
- **클라이언트 PDF**: `jspdf`는 이미 존재 — ERD 다이어그램 이미지 PDF 내보내기용
- **서버 PDF**: 보고서 PDF (월간/주간)는 서버에서 집계 데이터를 포함해 생성해야 함 — DB 조회 → 계산 → PDF 순서

iText 7은 AGPL — 이를 사용하면 애플리케이션 전체 소스를 공개해야 한다. OpenPDF 3.0.3은 LGPL/MPL로 이 제약이 없다. JasperReports는 `.jrxml` 템플릿 파일이 필요하고 설정이 무거워서 단순 보고서에 과도하다.

---

## 설치 명령

```bash
# 프론트엔드 추가 (client/ 디렉토리에서)
npm install --cache /tmp/npm-cache-smarterd @svar-ui/react-gantt @tanstack/react-table recharts react-number-format date-fns

# Radix UI (이미 있는 버전과 동일 범위로 설치)
npm install --cache /tmp/npm-cache-smarterd @radix-ui/react-progress @radix-ui/react-slider
```

```gradle
// build.gradle 추가 (백엔드)
implementation 'com.github.librepdf:openpdf:3.0.3'
```

---

## Alternatives Considered

| 추천 | 대안 | 대안을 쓸 상황 |
|------|------|----------------|
| `@svar-ui/react-gantt` | `frappe-gantt` | 극단적으로 단순한 Gantt만 필요하고 React wrapper 관리를 직접 하려는 경우 |
| `@svar-ui/react-gantt` | `Bryntum Gantt` | 엔터프라이즈 팀이 Critical Path, 자동 스케줄링, MS Project 연동이 필수인 경우 |
| `recharts` | `react-chartjs-2` | 번들 크기가 매우 민감하거나 Canvas 기반 렌더링이 필요한 경우 (Canvas가 SVG보다 대용량 데이터에서 빠름) |
| `recharts` | `Victory` | 데이터 과학/리서치 도구로 학술적 차트 유형이 필요한 경우 |
| `openpdf:3.0.3` | `JasperReports` | 복잡한 픽셀 단위 레이아웃 보고서 템플릿을 비개발자가 관리해야 하는 경우 |
| `openpdf:3.0.3` | `Apache FOP` | XSL-FO 기반 XML 템플릿으로 보고서를 구조화하려는 경우 |

---

## What NOT to Use

| 피해야 할 것 | 이유 | 대신 사용 |
|-------------|------|---------|
| `iText 7` | AGPL 라이선스 — 사용 시 애플리케이션 전체 소스 공개 의무 | `openpdf:3.0.3` (LGPL/MPL) |
| `react-beautiful-dnd` | 공식 유지보수 종료, React 18+ 호환 문제 | 이미 존재하는 `@dnd-kit` |
| `react-sortable-tree` | React 17+에서 미지원, 오래된 `react-dnd` 의존 | `@tanstack/react-table` + `@dnd-kit` 조합 |
| `moment.js` | 번들 크기 (~300KB), tree-shaking 불가, 공식 레거시 선언 | `date-fns` |
| `DHTMLX Gantt` (무료 버전) | GPL 라이선스 — 오픈소스 강제 적용 조항 | `@svar-ui/react-gantt` MIT |
| `Bryntum Gantt` | 개발자 1인당 $940 이상 상용 라이선스 | `@svar-ui/react-gantt` MIT |
| `d3` 직접 사용 | 차트 하나를 위해 D3 전체를 학습/유지하는 비용 과다 | `recharts` |

---

## Version Compatibility

| 패키지 | 호환 버전 | 비고 |
|--------|----------|------|
| `@svar-ui/react-gantt@2.6.1` | React ^19.x | v2.3에서 React 19 공식 지원 명시 |
| `@tanstack/react-table@8.21.3` | React ^16.8 이상 | React 19 문제 없음 |
| `recharts@3.8.1` | React 16/17/18/19 모두 지원 | GitHub issue #4558 해결 확인 |
| `openpdf@3.0.3` | Java 8+ (Java 25 문제 없음) | 패키지명 `org.openpdf`로 변경 (v3.0.0부터) |
| `date-fns@4.x` | React 무관 (pure JS) | v3→v4 breaking: timezone 함수 분리 (date-fns-tz 불필요) |
| `@dnd-kit/core@6.3.1` | 이미 존재 — WBS 재사용 가능 | 추가 설치 불필요 |

---

## Stack Patterns by Use Case

**WBS 트리 구현 패턴:**
- `@tanstack/react-table` + `getSubRows` + `getExpandedRowModel` → 계층 그리드
- `@dnd-kit/sortable` (기존) → 같은 레벨 내 태스크 순서 변경
- 중첩 수준 제한: WBS는 일반적으로 3~4단계 → 깊은 재귀 렌더링 불필요

**간트 차트 연동 패턴:**
- WBS 태스크 데이터를 `GanttTask` 형식으로 변환하는 어댑터 레이어 필요
- `@svar-ui/react-gantt`의 `tasks` prop은 `{ id, text, start_date, end_date, parent, progress }` 구조
- WBS의 계층 구조는 `parent` 필드로 간트에 그대로 전달 가능

**보고서 PDF 패턴 (백엔드):**
- Spring MVC Controller → Service에서 집계 → OpenPDF Document 빌드 → `ResponseEntity<byte[]>` 반환
- Content-Type: `application/pdf`, Content-Disposition: `attachment; filename="report.pdf"`
- 템플릿 방식보다 코드로 레이아웃을 직접 구성하는 것이 단순 보고서에 적합

**비용 입력 패턴 (프론트엔드):**
- `react-number-format`의 `NumericFormat` 컴포넌트로 천 단위 구분자 자동 처리
- 저장 시에는 raw 숫자로 변환 후 API 전송 (`getInputNumberValue`)

---

## Sources

- `@svar-ui/react-gantt` — [SVAR 공식 사이트](https://svar.dev/react/gantt/), [npm](https://www.npmjs.com/package/@svar-ui/react-gantt) — React 19 지원, MIT 라이선스, v2.6.1 확인 — HIGH confidence
- `@tanstack/react-table` — [공식 문서](https://tanstack.com/table/v8/docs/guide/expanding) — v8 계층 데이터 공식 지원 확인 — HIGH confidence
- `recharts` — [npm](https://www.npmjs.com/package/recharts), [GitHub](https://github.com/recharts/recharts) — v3.8.1, React 19 지원 확인 — HIGH confidence
- `openpdf` — [GitHub](https://github.com/LibrePDF/OpenPDF), [Maven Central](https://central.sonatype.com/artifact/com.github.librepdf/openpdf) — v3.0.3, LGPL/MPL 라이선스 확인 — MEDIUM confidence (v3.0.0 패키지명 변경 주의)
- Apache POI `poi-ooxml:5.4.1` — 이미 `build.gradle`에 존재 — HIGH confidence
- `@dnd-kit` — 이미 `client/package.json`에 존재 — HIGH confidence
- 간트 차트 비교 — [SVAR 벤치마크](https://svar.dev/blog/react-gantt-benchmark/), [Bryntum Top 5](https://bryntum.com/blog/top-5-javascript-gantt-chart-libraries/), [DHTMLX 2026 가이드](https://dhtmlx.com/blog/top-8-javascript-gantt-chart-libraries-2026/) — WebSearch 검증 — MEDIUM confidence

---
*Stack research for: SI 프로젝트 관리 기능 추가 (WBS, 마일스톤, 간트, 비용, 보고서)*
*Researched: 2026-04-02*
