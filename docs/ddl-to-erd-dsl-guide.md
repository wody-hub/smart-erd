# DDL -> ERD DSL 변환 가이드

이 문서는 Smart ERD에서 사용하는 ERD DSL 문법과, SQL DDL을 해당 문법(및 ERD 모델)으로 변환할 때 따라야 할 기준을 정리한다.

## 1. ERD DSL 문법 (구현 기준)

### 1.1 테이블 블록

```dsl
Table <테이블논리명> {
  <컬럼정의>
  <컬럼정의>
}
```

- 키워드는 반드시 `Table` (대문자 T) 사용
- `Table` 선언 뒤에는 반드시 `{ ... }` 블록이 있어야 함
- `//` 이후는 주석 처리

### 1.2 컬럼 한 줄 문법

```dsl
<컬럼논리명> [> <부모테이블논리명>.<부모컬럼논리명>] [:<도메인논리명>] [::<물리타입>] [[PK, AI, NN]]
```

- `> 부모테이블.부모컬럼`: FK 참조
- `:도메인`: 도메인 지정
- `::타입`: 타입 직접 지정
- `[PK, AI, NN]`: 옵션 블록
- `:도메인` 과 `::타입`은 동시에 사용 불가

### 1.3 옵션 의미

- `PK`: Primary Key
- `AI`: Auto Increment
- `NN`: Not Null

참고:
- `PK`가 있으면 nullable은 자동으로 `false` 처리됨
- 옵션 문자열은 대소문자 무시로 해석되지만, 표준 표기는 대문자 권장

## 2. DDL -> ERD DSL 매핑 규칙

DDL 파싱 결과를 ERD DSL로 표현할 때 기본 매핑은 아래를 따른다.

| DDL 정보 | ERD 내부 모델 | DSL 출력 규칙 |
|---|---|---|
| 테이블 물리명 | `table.name` | `Table` 이름(논리명 없음 시) |
| 테이블 논리명 (`COMMENT ON TABLE` 또는 MySQL table comment) | `table.logicalTableName \|\| table.comment` | `Table` 이름 우선값 |
| 컬럼 물리명 | `column.name` | 컬럼 이름(논리명 없음 시) |
| 컬럼 논리명 (`COMMENT ON COLUMN` 또는 MySQL column comment) | `column.logicalName \|\| column.comment` | 컬럼 이름 우선값 |
| PK | `column.pk` | `[PK]` 포함 |
| Auto Increment | `column.autoIncrement` | `[AI]` 포함 |
| NOT NULL | `column.nullable=false` | `[NN]` 포함 (단, PK 컬럼은 생략 가능) |
| FK (inline REFERENCES / table constraint / ALTER ADD CONSTRAINT) | `relations[]` | `> 부모테이블.부모컬럼` |
| 물리 타입 | `column.type` | 도메인 미사용 시 `::타입` |

도메인(`:도메인`)은 DDL만으로 복원되지 않으므로, 일반적으로 DDL 변환 결과 DSL은 `::타입` 기반으로 출력하는 것을 권장한다.

## 3. 현재 DDL 파서 지원 범위

### 3.1 지원

- `CREATE TABLE`
  - 컬럼 정의
  - 인라인/테이블 레벨 `PRIMARY KEY`
  - 인라인 `REFERENCES`
  - 테이블 레벨 `FOREIGN KEY (...) REFERENCES ...`
- `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...`
- 주석 기반 논리명 복원
  - `COMMENT ON TABLE ... IS '...'`
  - `COMMENT ON COLUMN ... IS '...'`
  - MySQL inline `COMMENT` (table/column)

### 3.2 부분 지원 / 주의

- DBMS 파서 선택값: `postgresql | mysql | oracle | sqlserver | ansi`
- `oracle`, `ansi`는 내부적으로 MySQL 파서를 사용하므로 문법 호환은 best-effort
- PostgreSQL 일부 identity 구문은 파서 호환용 전처리 후 해석

### 3.3 비대상(무시/미반영 가능)

- `UNIQUE`, `CHECK`, `DEFAULT`, `INDEX`, `TRIGGER`, `VIEW`, `SEQUENCE` 등은 ERD DSL 핵심 속성으로 직접 반영되지 않음

## 4. 권장 변환 절차 (외부 시스템용)

1. 대상 DBMS를 지정해 DDL을 파싱한다.
2. 테이블/컬럼/PK/FK/nullable/autoIncrement/type/comment를 추출한다.
3. 테이블명은 `logicalName(comment) 우선, 없으면 physicalName`으로 결정한다.
4. 컬럼명도 동일 규칙(`logical 우선`)으로 결정한다.
5. 각 컬럼에 대해:
   - FK가 있으면 `> 부모테이블.부모컬럼` 추가
   - 도메인 정보가 없으면 `::타입` 추가
   - `PK/AI/NN` 옵션을 계산해 `[...]`로 추가
6. `Table ... { ... }` 블록으로 직렬화한다.

## 5. 예시

입력 DDL:

```sql
CREATE TABLE team (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE app_user (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES team(id),
  memo VARCHAR(500)
);

COMMENT ON TABLE team IS '팀';
COMMENT ON TABLE app_user IS '사용자';
COMMENT ON COLUMN team.id IS '아이디';
COMMENT ON COLUMN team.name IS '이름';
COMMENT ON COLUMN app_user.id IS '아이디';
COMMENT ON COLUMN app_user.team_id IS '팀아이디';
COMMENT ON COLUMN app_user.memo IS '메모';
```

권장 출력 DSL:

```dsl
Table 팀 {
  아이디 ::BIGINT [PK, AI]
  이름 ::VARCHAR(100) [NN]
}

Table 사용자 {
  아이디 ::BIGINT [PK, AI]
  팀아이디 > 팀.아이디 ::BIGINT [NN]
  메모 ::VARCHAR(500)
}
```

## 6. 구현상 제약 요약

- DSL 식별자(테이블/컬럼/도메인/FK 참조)는 공백 없는 토큰 기준으로 파싱됨
- `Table` 블록 문법은 엄격(중괄호 누락/불일치 시 에러)
- 한 컬럼에서 `:도메인` + `::타입` 동시 지정 불가
- DDL의 `schema.table` 표기는 파싱 시 마지막 식별자(`table`) 기준으로 처리됨
- DDL 파싱은 부분 성공을 허용하며, 실패 문장이 있어도 파싱 가능한 테이블/관계는 반영 가능
