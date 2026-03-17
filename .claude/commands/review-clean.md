# 클린코드 점검자

Martin Fowler의 리팩터링 카탈로그 기반으로 **코드 악취(Code Smell), 복잡도, 스파게티 코드**를 점검한다. 점검 대상은 `$ARGUMENTS`이다. 인자가 없으면 최근 변경 파일(`git diff --name-only` + `git ls-files --others --exclude-standard`)을 대상으로 한다.

> 코딩 컨벤션은 `/review-convention`이, 설계/보안은 `/review-arch`가, 디자인/퍼블리싱은 `/review-design`이 담당한다. 이 점검자는 **함수·클래스 수준의 코드 악취와 인지 복잡도**를 다룬다.

## 점검 절차

1. 점검 대상 파일을 파악한다. 인자가 없으면 `git diff --name-only`와 `git ls-files --others --exclude-standard`로 변경/신규 파일 목록을 수집한다.
2. 대상 파일들을 **모두 읽고** 아래 체크리스트를 기준으로 점검한다. 함수 단위로 줄 수, 중첩 깊이, 분기 수를 세며 악취를 식별한다.
3. 점검 결과를 심각도별로 정리하고, 위반 사항에는 **구체적인 파일:라인번호, 코드 스니펫, 리팩터링 제안**을 포함한다.

## 정량 기준 (Threshold)

| 메트릭 | 주의 (Medium) | 위험 (High) |
|--------|---------------|-------------|
| 함수 줄 수 | > 50줄 | > 80줄 |
| 중첩 깊이 (if/for/callback 중첩) | > 3단계 | > 5단계 |
| 함수 파라미터 수 | > 4개 | > 6개 |
| 파일 줄 수 | > 300줄 | > 500줄 |
| 순환 복잡도 (분기 수) | > 10 | > 15 |
| React Hook 내 useRef 수 | > 6개 | > 10개 |
| React Hook 내 useEffect 수 | > 4개 | > 6개 |
| 클래스/인터페이스 필드 수 | > 10개 | > 15개 |

## 공통 체크리스트 — 코드 악취 카탈로그

### 1. Long Method / Long Function (High)

- [ ] 함수가 50줄을 초과하는지 확인. 80줄 초과 시 반드시 분리 권장
- [ ] 콜백 함수(useEffect 내부, setTimeout 내부, Promise.then 내부)가 인라인으로 30줄을 초과하는지 확인 — 명명 함수로 추출 권장
- [ ] 하나의 함수가 **2개 이상의 추상화 수준**을 혼합하는지 확인 (예: DOM 조작 + 비즈니스 로직, 파싱 + 상태 업데이트)

### 2. Deep Nesting / Arrow Anti-pattern (High)

- [ ] if/for/switch/try/callback 중첩이 3단계를 초과하는지 확인
- [ ] Early return(Guard Clause)으로 중첩을 줄일 수 있는 곳이 있는지 확인
- [ ] else 절이 불필요한 곳(if 절이 return/throw/continue로 끝남)에서 사용되고 있는지 확인
- [ ] 삼항 연산자가 중첩(`a ? b ? c : d : e`)되어 있는지 확인

### 3. Duplicated Code / DRY 위반 (High)

- [ ] 3줄 이상의 동일 또는 유사한 로직이 2곳 이상에서 반복되는지 확인
- [ ] 복사-붙여넣기 후 일부만 수정한 "almost-duplicate" 패턴이 있는지 확인
- [ ] 중복 코드가 있다면 공통 함수/훅/유틸리티로 추출 가능한지 제안
- [ ] 동일한 가드 조건(null 체크, 유효성 검증)이 여러 곳에서 반복되는지 확인

### 4. Long Parameter List (Medium)

- [ ] 함수 파라미터가 4개를 초과하는지 확인
- [ ] boolean 파라미터가 함수 동작을 분기하는 데 사용되는지 확인 (Flag Argument 악취)
- [ ] 연관된 파라미터 그룹이 객체/인터페이스로 묶일 수 있는지 확인 (Parameter Object)

### 5. Feature Envy / 데이터 질투 (Medium)

- [ ] 함수가 자신이 속한 모듈의 데이터보다 **다른 모듈의 데이터를 더 많이** 참조하는지 확인
- [ ] 깊은 프로퍼티 접근(`.a.b.c.d`)이 반복되는지 확인 — 디미터 법칙(Law of Demeter) 위반
- [ ] 다른 객체의 내부 상태를 꺼내서 계산한 후 다시 넣는 패턴이 있는지 확인

### 6. Shotgun Surgery / 산탄총 수술 (Medium)

- [ ] 하나의 변경 사유가 여러 파일/함수를 동시에 수정해야 하는 구조인지 확인
- [ ] 관련된 상태(ref, state, constant)가 여러 곳에 흩어져 있어 하나를 바꾸면 나머지도 바꿔야 하는지 확인
- [ ] 수정 시 놓치기 쉬운 "연쇄 수정" 포인트가 있는지 확인

### 7. Dead Code / 죽은 코드 (Medium)

- [ ] 절대 실행되지 않는 분기(unreachable code)가 있는지 확인
- [ ] 주석 처리된 코드 블록이 남아 있는지 확인 (VCS가 이력 관리하므로 삭제 권장)
- [ ] 호출되지 않는 함수/메서드가 있는지 확인
- [ ] 값이 할당된 후 사용되지 않고 덮어쓰여지는 변수(dead assignment)가 있는지 확인

### 8. Primitive Obsession / 원시 타입 집착 (Low)

- [ ] 도메인 의미가 있는 값이 원시 타입(`string`, `number`)으로만 전달되는지 확인 (예: `userId: string` 대신 `UserId` 타입)
- [ ] 매직 넘버/매직 스트링이 이름 없이 인라인으로 사용되는지 확인
- [ ] 상태를 문자열 리터럴 유니온으로 관리할 때 의미가 불명확한 값이 있는지 확인

### 9. Speculative Generality / 과잉 설계 (Low)

- [ ] 현재 사용되지 않는 추상화(인터페이스, 제네릭, 팩토리)가 "나중에 쓸 수 있으니까" 만들어져 있는지 확인
- [ ] 하나의 구현체만 있는 인터페이스가 불필요하게 존재하는지 확인
- [ ] 파라미터나 옵션이 현재 하나의 값으로만 사용되는데 유연성을 위해 복잡하게 만들어져 있는지 확인

## 백엔드 추가 체크리스트 (Java / Spring Boot)

### 10. God Class / 비대한 클래스 (High)

- [ ] Service 클래스가 300줄을 초과하는지 확인 — 관심사별 Service 분리 권장
- [ ] 하나의 Service가 3개 이상의 Repository를 주입받는지 확인 — 책임 과다 의심
- [ ] Controller가 비즈니스 로직을 포함하는지 확인 — Service로 위임 필수

### 11. Mutable Shared State (Medium)

- [ ] Service/Component에 인스턴스 필드(`private List<...>`, `private Map<...>`)가 상태를 저장하는지 확인 — Spring Bean은 싱글톤이므로 스레드 안전성 문제
- [ ] static mutable 필드가 있는지 확인

### 12. Exception Swallowing (Medium)

- [ ] 빈 catch 블록(`catch (Exception e) { }`)이 있는지 확인
- [ ] catch에서 원본 예외를 로깅하지 않고 새 예외만 던지는지 확인 (스택 트레이스 유실)
- [ ] 너무 넓은 예외 타입(`Exception`, `Throwable`)을 잡는지 확인

## 프론트엔드 추가 체크리스트 (TypeScript / React)

### 13. God Hook / 비대한 커스텀 훅 (High)

- [ ] 커스텀 훅이 300줄을 초과하는지 확인 — 서브 훅으로 분리 권장
- [ ] 하나의 훅이 6개 이상의 `useRef`를 사용하는지 확인 — 상태 머신 복잡도 의심
- [ ] 하나의 훅이 4개 이상의 `useEffect`를 사용하는지 확인 — 관심사 분리 필요
- [ ] 훅이 반환하는 값이 5개를 초과하는지 확인 — 인터페이스 과대

### 14. Stale Closure / 클로저 함정 (High)

- [ ] `useCallback`/`useEffect` 내부에서 state/prop을 직접 참조하면서 의존성 배열에 누락된 값이 있는지 확인
- [ ] `setTimeout`/`setInterval` 콜백에서 state를 직접 참조하는지 확인 — ref 미러링 필요
- [ ] 이벤트 리스너 콜백에서 최신 state에 접근하기 위해 ref 패턴을 사용해야 하는 곳이 빠져 있는지 확인

### 15. Render-triggered Side Effects (Medium)

- [ ] 렌더 함수 본문(JSX 밖)에서 부수효과(API 호출, DOM 조작, 상태 변경)를 직접 실행하는지 확인
- [ ] `useMemo`/`useCallback` 내부에서 부수효과를 실행하는지 확인 (순수 함수여야 함)
- [ ] `useEffect` 없이 렌더 중에 `setState`를 호출하는 곳이 있는지 확인 (무한 렌더 루프)

### 16. Prop Drilling (Low)

- [ ] 동일한 prop이 3단계 이상 중간 컴포넌트를 거쳐 전달되는지 확인
- [ ] 중간 컴포넌트가 해당 prop을 사용하지 않고 단순 전달만 하는지 확인
- [ ] Context 또는 Zustand 스토어로 대체 가능한지 제안

## 출력 형식

```markdown
## 클린코드 점검 결과

### 점검 대상
- 파일 N개: (파일 목록)

### 정량 메트릭

| 파일 | 줄 수 | 최대 함수 길이 | 최대 중첩 | useRef | useEffect | 평가 |
|------|-------|---------------|----------|--------|-----------|------|
| `파일명.ts` | 461 | 78줄 (`함수명`) | 5단계 | 10 | 8 | ⚠️ |
| ... | ... | ... | ... | ... | ... | ... |

### 요약
| # | 악취 | 심각도 | 카탈로그 | 영역 |
|---|------|--------|----------|------|
| 1 | (이슈 한 줄 요약) | High / Medium / Low | Long Method / Deep Nesting / ... | BE / FE |
| ... | ... | ... | ... | ... |

### 상세

#### 1. [심각도] 악취 이름 — 이슈 요약

**위치:** `파일명.ts:라인-라인` (함수명)

**현재 코드:**
```언어
(문제 코드 스니펫)
```

**악취:**
(Martin Fowler 카탈로그 기준 어떤 악취에 해당하는지 + 구체적 문제 설명)

**리팩터링:**
(Extract Method, Replace Conditional with Guard Clause 등 구체적 리팩터링 기법 + 의사 코드)

---

(이슈별 반복)

### 총평
(전체 코드 건강도 1-3문장 요약 + 우선순위별 리팩터링 로드맵)
```
