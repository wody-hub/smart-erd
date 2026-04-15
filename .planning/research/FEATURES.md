# Feature Research

**Domain:** SI 프로젝트 관리 플랫폼 (한국 IT 아웃소싱/시스템통합)
**Researched:** 2026-04-02
**Confidence:** MEDIUM — 한국 SI 업계 실무 패턴 기반, 공식 표준 가이드(KOSA/CISP) 확인, 도구 경쟁사 분석 병행

---

## 한국 SI 업계 특수성 메모

연구에서 드러난 한국 SI 프로젝트의 구조적 특성:

1. **공식 산출물 체계 존재** — 한국정보화진흥원(NIA) 및 CISP의 CBD SW개발 표준 산출물 가이드가 공공 SI에 준용됨. 분석/설계/구현/시험/전개 5단계 구조가 표준.

2. **M/M(맨먼스) 중심 비용 구조** — 직접인건비 = 월임금 × 투입공수 × 참여율. 인력 등급은 초급/중급/고급/특급. 제경비는 직접인건비의 140~150%. 이 공식이 프로젝트 예산 산정의 공식 기준.

3. **발주처 보고 의무** — 주간보고서/월간보고서는 계약 조건에 포함됨. 일일보고는 내부 관리용, 주간/월간은 발주처 제출 필수.

4. **산출물 = 납품물** — 검수는 산출물 목록 기준으로 이루어짐. 화면설계서, ERD, 테이블정의서, 테스트 결과서가 핵심 납품물.

5. **변경 관리가 핵심 갈등 포인트** — 범위 변경, 요구사항 추가는 변경요청서 → 회의록 승인 → WBS 재산정 프로세스를 따름. 이를 관리 못 하면 프로젝트 실패.

---

## Feature Landscape

### Table Stakes (Users Expect These)

기본 기능 없으면 사용자가 떠남.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 사업 개요 (프로젝트 메타) | 계약 기간, 발주처, 계약 금액, 사업 범위는 모든 SI 프로젝트의 출발점. 없으면 관리 기준이 없음 | LOW | 발주처명, 수주사, 계약금액, 사업기간, 사업 범위 필드 |
| WBS (작업분해구조) | 공공/민간 모두 WBS 없이 착수 불가. 산출물 목록 기준이 되고, M/M 산정 근거가 됨 | HIGH | 계층 구조(업무 > 세부작업 > 태스크), 담당자/기간/진척률/M/M |
| 간트 차트 시각화 | WBS를 시각적으로 표현. 발주처 보고서에 첨부 필수. 기간/진척 파악에 직관적 | HIGH | WBS 데이터 기반 렌더링, 타임라인 뷰 |
| 마일스톤 관리 | 착수/분석완료/설계완료/개발완료/검수 등 공식 이정표. 계약서에 기재됨 | MEDIUM | 마일스톤별 목표일, 실제완료일, 연결 산출물 |
| 인력 투입 계획 & 실적 | M/M 기반 계약에서 계획 vs 실적 관리는 비용 정산의 직접 근거 | MEDIUM | 역할별 투입기간·참여율·M/M 계획/실적, 단가 |
| 주간 보고서 | 발주처 제출 의무. 형식: 주간 진척, 이슈/리스크, 다음 주 계획 | MEDIUM | 템플릿 기반 자동 집계, 수작업 편집 가능 |
| 월간 보고서 | 발주처/PMO 보고 의무. 형식: 월간 실적, M/M 현황, 마일스톤 달성 | MEDIUM | 주간 데이터 집계, 인력/비용 현황 포함 |
| 이슈 트래커 | 이슈 등록/담당자/상태(오픈→처리중→완료)/우선순위. 검수 시 미결 이슈 목록 제출 | MEDIUM | 이슈 등록, 담당자 배정, 상태 추적, 이슈 목록 내보내기 |
| 산출물 체계 (단계별) | 분석/설계/구현/시험/전개 단계별 산출물 목록 + 상태(미작성/작성중/검수중/완료) | MEDIUM | 표준 산출물 목록 템플릿, 상태 추적, 문서 연결 |
| 요구사항 추적 매트릭스 (RTM) | 공공 SI 필수. 요구사항 → 설계 → 구현 → 테스트 연결. 검수 근거 | HIGH | RTM 테이블 편집, 추적 상태 관리 |
| 회의록 관리 | 변경 관리의 핵심 증거. 마크다운 문서 플러그인 활용 가능 | LOW | 기존 Markdown 플러그인 활용, 날짜/참석자/결정사항 메타 추가 |
| 변경 관리 로그 | 범위/일정/인력 변경은 반드시 문서화. 분쟁 예방 필수 | MEDIUM | 변경요청 → 승인 → 반영 상태 흐름, 변경 이력 |

### Differentiators (Competitive Advantage)

경쟁 우위가 되는 기능.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 실시간 협업 WBS/간트 편집 | 기존 Excel/MS Project는 단독 편집, 충돌 빈번. Yjs 기반 실시간 공동 편집은 SI 도구에서 희소 | HIGH | 기존 Yjs 협업 코어 활용. Y.Map 중심 구조 |
| WBS ↔ ERD ↔ 화면설계서 산출물 연결 | 같은 플랫폼에서 ERD가 WBS 산출물 항목에 직접 연결. 별도 링크 없이 산출물 추적 가능 | MEDIUM | 기존 Diagram/Document 시스템과 연동 |
| 보고서 자동 집계 | WBS 진척률, 이슈 현황, M/M 실적을 자동 집계하여 보고서 초안 생성. 수작업 보고서 제거 | HIGH | 데이터 연동 설계 복잡, 단 효과는 매우 큼 |
| 산출물 단계별 상태 대시보드 | 단계별 산출물 진행률을 한 화면에서 확인. 감리 대응에 유용 | MEDIUM | 기존 문서 허브 확장 |
| 비용 시뮬레이션 (M/M 기반) | 투입 인력/기간 변경 시 예상 비용 즉시 계산. 견적 재산정 지원 | MEDIUM | SW 대가산정 공식 적용, 노임단가 데이터 연동 필요 |
| 일일 보고서 → 주간/월간 자동 롤업 | 일일 작업 내역을 입력하면 주간/월간 보고서에 자동 반영. SI 현장의 보고 부담 감소 | HIGH | 구조화된 일일 보고 입력 UI 필요 |
| ERD → 테이블정의서 자동 생성 | ERD 설계 결과를 테이블정의서(컬럼명/타입/PK/FK/설명) 문서로 자동 내보내기 | MEDIUM | 기존 ERD 데이터 활용, 문서 포맷 변환 |
| 화면설계서 플러그인과 WBS 연결 | 화면 목록 = WBS 작업 단위. 화면 완성도가 WBS 진척률에 반영 | HIGH | 화면기획 플러그인 완성 이후 가능 |
| 데스크톱 앱 오프라인 지원 | 고객사 방문/현장에서 인터넷 없이 사용. 공공기관 망분리 환경 대응 | MEDIUM | 기존 Electron 앱 기반 |

### Anti-Features (Commonly Requested, Often Problematic)

흔히 요청되지만 문제가 되는 기능.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 완전한 Agile/스프린트 관리 | 일부 SI 팀이 애자일 도입 시도 | 한국 SI는 폭포수 납품 계약이 지배적. 스프린트 포인트/번다운 차트는 발주처에 맞지 않음 | WBS + 마일스톤 기반 단계 관리로 충분 |
| 자원 용량 계획 (Resource Capacity Planning) | PM이 요청 | 구현 비용 높고 M/M 단순 계산과 중복됨. 사람 일정 최적화는 SI보다 IT 운영에 적합 | 인력 투입 계획표(M/M 실적 기반)로 대체 |
| 타임시트/시간 기록 (Jira Tempo 수준) | 시간 단위 추적 요구 | 한국 SI는 일/주 단위 보고, 시간 단위 입력 거부감 높음. M/M 월 단위가 계약 기준 | 일일 보고서(당일 작업 요약)로 충분 |
| 이메일 통합 | 발주처 이메일을 플랫폼에서 관리 | 이메일 플로우 도구는 별도 시장(Gmail, Outlook). SI 경계를 초과하는 범위 | 회의록 + 공지 시스템으로 내부 소통 관리 |
| 인사/급여 연동 | 인건비 자동 계산 요청 | 회사별 인사 시스템 다양, 연동 비용 높음. 개인 단가 데이터는 민감 | 단가 수동 입력 + M/M 자동 계산 |
| AI 기반 일정 자동 추천 | 미래 기능으로 기대 | 훈련 데이터 부족, SI 프로젝트 편차 극심. 잘못된 추천이 더 위험 | 명시적 WBS 입력 + 통계 기반 참고 정보 |
| 파일 저장소 (드라이브 기능) | 산출물 파일 첨부 요구 | 용량 관리, 버전 관리 복잡도 급증. 기존 Google Drive/SharePoint와 경쟁 | 외부 링크 첨부(URL) + 플랫폼 내 문서(ERD/마크다운)로 커버 |

---

## Feature Dependencies

```
사업 개요
    └──provides-context-for──> WBS
                                └──feeds-data-into──> 간트 차트
                                └──feeds-data-into──> 마일스톤 관리
                                └──requires──> 인력 투입 계획 (M/M)
                                                └──feeds-data-into──> 비용 관리

인력 투입 계획 (M/M)
    └──feeds-data-into──> 월간 보고서 (M/M 현황)
    └──feeds-data-into──> 비용 시뮬레이션

이슈 트래커
    └──feeds-data-into──> 주간/월간 보고서 (이슈 현황)
    └──links-to──> WBS 태스크

일일 보고서
    └──rolls-up-into──> 주간 보고서
                            └──rolls-up-into──> 월간 보고서

산출물 체계 (단계별)
    └──links-to──> ERD (설계 단계 산출물)
    └──links-to──> 화면설계서 (설계 단계 산출물)
    └──links-to──> 마크다운 문서 (각 단계 산출물)

요구사항 추적 매트릭스 (RTM)
    └──requires──> 산출물 체계 (설계/구현 항목 참조)
    └──feeds-data-into──> 검수 체크리스트

변경 관리 로그
    └──links-to──> 회의록 (변경 승인 근거)
    └──affects──> WBS (범위/일정 재산정)

화면기획 플러그인 (Active 개발 중)
    └──enables──> 화면설계서 플러그인 ↔ WBS 연결 (Differentiator)
    └──enables──> ERD → 테이블정의서 자동 생성 강화
```

### Dependency Notes

- **WBS requires 사업 개요:** 사업 기간, 인력 체계가 WBS 기간/담당자 설정의 전제 조건.
- **간트 차트 requires WBS:** WBS 데이터가 없으면 간트 차트 렌더링 불가. 별도 입력 화면 아님.
- **보고서 자동 집계 requires WBS + 이슈 트래커 + 인력 투입:** 데이터가 구조화되어 있어야 자동 집계 가능. 이 세 기능이 먼저 안정화되어야 함.
- **요구사항 추적 매트릭스 requires 산출물 체계:** RTM은 요구사항과 산출물 항목을 연결하므로 산출물 목록이 먼저 정의되어야 함.
- **화면설계서 ↔ WBS 연결 requires 화면기획 플러그인:** 현재 Active 개발 중인 화면기획 플러그인 완성 이후 가능.

---

## MVP Definition

### Launch With (v1) — SI PM 기능 첫 마일스톤

최소한 이것이 있어야 "PM 기능 있는 ERD 도구"가 됨.

- [ ] **사업 개요** — 발주처, 계약 기간, 계약 금액, 사업 범위. 프로젝트 헤더에 해당. 없으면 시작 불가.
- [ ] **WBS 편집** — 계층 작업 분해, 담당자, 기간, 진척률, M/M. 핵심 PM 기능.
- [ ] **간트 차트 시각화** — WBS 기반 타임라인 뷰. 발주처 보고서 첨부용.
- [ ] **마일스톤 관리** — WBS와 별개 레이어로 이정표 관리.
- [ ] **인력 투입 계획 & 실적** — M/M 계획/실적 표. 비용 관리의 핵심.
- [ ] **이슈 트래커** — 이슈 등록/상태/담당자. 검수 시 미결 이슈 목록 필수.

### Add After Validation (v1.x) — 보고 체계

WBS/마일스톤이 안정화된 후 보고 기능 추가.

- [ ] **주간 보고서** — WBS + 이슈 데이터 집계, 발주처 보고 형식.
- [ ] **월간 보고서** — 주간 집계 + M/M 현황 + 마일스톤 달성률.
- [ ] **산출물 체계** — 단계별 산출물 목록 + 상태 + 문서 연결.
- [ ] **변경 관리 로그** — 변경 요청 → 승인 → WBS 반영 흐름.

### Future Consideration (v2+) — 심화 기능

PMF 확인 후.

- [ ] **요구사항 추적 매트릭스 (RTM)** — 공공 SI 특화. 민간은 덜 필요. 구현 복잡도 높음.
- [ ] **보고서 자동 집계** — WBS + 이슈 + M/M 집계 자동화. 데이터 구조 안정화 후 가능.
- [ ] **비용 시뮬레이션** — 노임단가 데이터 연동 필요. 정확도 높이려면 외부 데이터 소스.
- [ ] **일일 보고서** — 보고 루틴 형성 후 추가. 주간보다 저항감 낮춘 후 도입.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 사업 개요 | HIGH | LOW | P1 |
| WBS 편집 | HIGH | HIGH | P1 |
| 간트 차트 | HIGH | HIGH | P1 |
| 마일스톤 관리 | HIGH | MEDIUM | P1 |
| 인력 투입 M/M | HIGH | MEDIUM | P1 |
| 이슈 트래커 | HIGH | MEDIUM | P1 |
| 주간 보고서 | HIGH | MEDIUM | P2 |
| 월간 보고서 | HIGH | MEDIUM | P2 |
| 산출물 체계 | MEDIUM | MEDIUM | P2 |
| 변경 관리 로그 | MEDIUM | MEDIUM | P2 |
| 회의록 관리 | MEDIUM | LOW | P2 |
| 보고서 자동 집계 | HIGH | HIGH | P3 |
| 요구사항 추적 매트릭스 | MEDIUM | HIGH | P3 |
| 비용 시뮬레이션 | MEDIUM | HIGH | P3 |
| 일일 보고서 | MEDIUM | MEDIUM | P3 |
| 화면설계서 ↔ WBS 연결 | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for SI PM 마일스톤 launch
- P2: Should have, add in v1.x
- P3: Nice to have, v2+ or after PMF

---

## Competitor Feature Analysis

기존에 한국 SI 현장에서 사용되는 도구들과 비교.

| Feature | Excel/MS Project (현 표준) | Redmine/Jira | Smart-ERD 접근 |
|---------|--------------------------|--------------|----------------|
| WBS | Excel 수작업, 공유 어려움 | Jira Epic/Story (애자일 중심) | 실시간 협업 WBS, SI 납품 구조 |
| 간트 차트 | MS Project (유료, 복잡) | Jira Timeline (별도 설정 필요) | WBS 기반 자동 렌더링 |
| M/M 비용 관리 | Excel 수식 | 없음 (개발자 중심 도구) | M/M 공식 내장, SW 대가산정 기반 |
| 보고서 | Word 수작업, 매주 고통 | 없음 (발주처 보고 개념 없음) | 자동 집계 템플릿 |
| ERD 연동 | 별도 툴 (ERDCloud 등) | 없음 | 동일 플랫폼, 산출물로 직접 연결 |
| 화면설계서 | Figma/PPT 별도 | 없음 | 화면기획 플러그인 (개발 중) |
| 실시간 협업 | Google Sheets (제한적) | Jira Cloud (이슈 단위) | Yjs 기반 문서 전체 실시간 |
| 이슈 추적 | Excel 이슈 목록 | Jira (기능 과잉) | 경량 이슈 트래커, SI 특화 |
| 데스크톱 오프라인 | Excel (파일 기반) | 없음 | Electron 앱 지원 |

**현 경쟁 지형 요약:** Excel이 여전히 한국 SI 현장의 실질적 표준. Jira는 기술팀 중심 스타트업에서 사용하지만 발주처 보고 체계와 맞지 않아 SI 납품 프로젝트에선 적합도 낮음. MS Project는 고기능이지만 가격/학습 장벽이 높고 실시간 협업 불가. Smart-ERD의 차별점은 ERD/화면설계서/PM 기능의 통합 + 실시간 협업.

---

## Sources

- [한국SW산업협회 대가산정 가이드 2024 (KISIA)](https://www.kisia.or.kr/bucket/uploads/2023/02/24/sw사업_대가산정_가이드(2022년_2차_개정판)_최종_0825.pdf) — M/M 계산, 제경비 기준 (MEDIUM confidence)
- [CBD SW개발 표준 산출물 관리 가이드 (CISP)](https://www.cisp.or.kr/wp-content/uploads/2012/01/20160909_074634.pdf) — 단계별 산출물 25개 표준 목록 (MEDIUM confidence)
- [SI 프로젝트 산출물 목록 (OpenBee)](https://openbee.kr/245) — 분석/설계/개발/구현 4단계 산출물 실무 목록 (MEDIUM confidence)
- [SI 프로젝트 산출물 (InCoDom)](https://incodom.kr/SI_%EC%82%B0%EC%B6%9C%EB%AC%BC) — 사업관리/시스템구축/DB구축 3분류 (MEDIUM confidence)
- [슬기로운 PM생활: SI 프로젝트 검수를 잘 받는 방법 (MobiInside, 2024)](https://www.mobiinside.co.kr/2024/05/08/project-4/) — 검수 전략, 요구사항 추적표 (MEDIUM confidence)
- [1억 넘는 진짜 프로젝트는 어떻게 할까? (Yozm IT)](https://yozm.wishket.com/magazine/detail/2578/) — 발주처 특성, 현장 협업 도구 (MEDIUM confidence)
- [SW 프로젝트 관리 현장 가이드 (DA블로그)](http://magmajjame.blogspot.com/2015/04/field-project-controll-for-system.html) — 보고서 체계, WBS, 기성고 관리 (LOW confidence, 2015년 자료)
- [맨먼스 산정 방법 (이랜서 블로그)](https://www.elancer.co.kr/blog/detail/174) — M/M 계산식 실무 가이드 (MEDIUM confidence)

---
*Feature research for: 한국 SI 프로젝트 관리 플랫폼*
*Researched: 2026-04-02*
