# 클린코드 체크리스트

Martin Fowler 리팩터링 카탈로그 기반으로 코드 악취(Code Smell), 복잡도, 스파게티 코드를 점검한다.

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

## 공통 체크리스트

### 1) Long Method / Long Function (High)

- 함수가 50줄을 초과하는지 확인한다. 80줄 초과 시 반드시 분리 권장.
- 콜백 함수(useEffect/setTimeout/Promise.then 내부)가 인라인으로 30줄을 초과하는지 확인한다.
- 하나의 함수가 2개 이상의 추상화 수준을 혼합하는지 확인한다.

### 2) Deep Nesting / Arrow Anti-pattern (High)

- if/for/switch/try/callback 중첩이 3단계를 초과하는지 확인한다.
- Guard Clause(Early return)로 중첩을 줄일 수 있는지 확인한다.
- if 절이 종료(return/throw/continue)되는데 불필요한 else를 사용하는지 확인한다.
- 중첩 삼항 연산자(`a ? b ? c : d : e`)를 확인한다.

### 3) Duplicated Code / DRY 위반 (High)

- 3줄 이상의 동일/유사 로직이 2곳 이상 반복되는지 확인한다.
- copy-paste 후 일부만 수정한 almost-duplicate 패턴을 확인한다.
- 공통 함수/훅/유틸리티 추출이 가능한지 확인한다.
- 동일 가드 조건(null 체크/유효성 검증) 반복을 확인한다.

### 4) Long Parameter List (Medium)

- 파라미터가 4개를 초과하는지 확인한다.
- boolean flag argument가 동작 분기에 쓰이는지 확인한다.
- 연관 파라미터를 Parameter Object로 묶을 수 있는지 확인한다.

### 5) Feature Envy / 데이터 질투 (Medium)

- 함수가 자신보다 다른 모듈 데이터를 더 많이 참조하는지 확인한다.
- 깊은 프로퍼티 접근(`.a.b.c.d`)이 반복되는지 확인한다.
- 타 객체 내부 상태를 꺼내 계산 후 다시 넣는 패턴을 확인한다.

### 6) Shotgun Surgery / 산탄총 수술 (Medium)

- 하나의 변경 사유가 여러 파일/함수 동시 수정을 요구하는지 확인한다.
- 관련 상태(ref/state/constant)가 흩어져 연쇄 수정을 유발하는지 확인한다.
- 변경 시 누락되기 쉬운 연쇄 수정 포인트를 확인한다.

### 7) Dead Code / 죽은 코드 (Medium)

- 도달 불가능 분기(unreachable code)를 확인한다.
- 주석 처리된 코드 블록 잔존 여부를 확인한다.
- 호출되지 않는 함수/메서드를 확인한다.
- dead assignment(할당 후 미사용 덮어쓰기)를 확인한다.

### 8) Primitive Obsession / 원시 타입 집착 (Low)

- 도메인 값이 원시 타입만으로 전달되는지 확인한다.
- 매직 넘버/매직 스트링 인라인 사용을 확인한다.
- 상태 문자열 리터럴 값 의미가 불명확한지 확인한다.

### 9) Speculative Generality / 과잉 설계 (Low)

- 현재 미사용 추상화(인터페이스/제네릭/팩토리)를 확인한다.
- 구현체 1개인 인터페이스가 불필요한지 확인한다.
- 단일 값으로만 쓰이는 옵션/파라미터가 과도하게 일반화됐는지 확인한다.

## 백엔드 추가 체크리스트 (Java / Spring Boot)

### 10) God Class / 비대한 클래스 (High)

- Service 클래스가 300줄을 초과하는지 확인한다.
- 하나의 Service가 3개 이상 Repository를 주입받는지 확인한다.
- Controller가 비즈니스 로직을 포함하는지 확인한다.

### 11) Mutable Shared State (Medium)

- Service/Component 인스턴스 필드에 가변 상태를 저장하는지 확인한다.
- static mutable 필드 사용 여부를 확인한다.

### 12) Exception Swallowing (Medium)

- 빈 catch 블록이 있는지 확인한다.
- 원본 예외 로깅 없이 새 예외만 던지는지 확인한다.
- 과도하게 넓은 예외 타입(`Exception`, `Throwable`)을 잡는지 확인한다.

## 프론트엔드 추가 체크리스트 (TypeScript / React)

### 13) God Hook / 비대한 커스텀 훅 (High)

- 커스텀 훅이 300줄을 초과하는지 확인한다.
- `useRef`가 6개 이상인지 확인한다.
- `useEffect`가 4개 이상인지 확인한다.
- 훅 반환값이 5개를 초과하는지 확인한다.

### 14) Stale Closure / 클로저 함정 (High)

- `useCallback`/`useEffect` 의존성 배열 누락을 확인한다.
- `setTimeout`/`setInterval` 콜백에서 state 직접 참조를 확인한다.
- 이벤트 리스너에서 최신 state 접근을 위한 ref 패턴 누락을 확인한다.

### 15) Render-triggered Side Effects (Medium)

- 렌더 본문에서 부수효과(API/DOM/setState) 실행 여부를 확인한다.
- `useMemo`/`useCallback` 내부 부수효과를 확인한다.
- 렌더 중 `setState` 호출 여부를 확인한다.

### 16) Prop Drilling (Low)

- 동일 prop이 3단계 이상 전달되는지 확인한다.
- 중간 컴포넌트가 단순 전달만 하는지 확인한다.
- Context/Zustand 대체 가능성을 제안한다.
