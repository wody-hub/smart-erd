# DDL → Smart ERD DSL 변환 AI 프롬프트

일반 SQL DDL을 Smart ERD의 DSL로 AI(ChatGPT/Claude 등)에게 변환시키기 위한 프롬프트와 규칙이다.
규칙은 파서 구현(`client/src/lib/dsl-parser.ts`, `dsl-generator.ts`, `dsl-keywords.ts`)과 기존 가이드(`docs/ddl-to-erd-dsl-guide.md`)를 기준으로 확인한 것이다.

## 먼저 알아둘 점 (사용 방법)

1. **이 DSL은 "논리명" 기반이다.** 테이블·컬럼 이름 자리에 쓰는 값은 팀 **데이터 사전(용어/단어)에 등록된 논리명**이어야 한다.
   - 사전에 없는 이름은 `사전에 없는 논리명` 에러가 나고, **에러가 하나라도 있으면 코드 편집기의 "적용"이 막힌다.**
   - 그래서 변환 시 가능하면 **사전 용어 목록(논리명 → 물리명)을 AI에게 함께 준다.** 주지 않으면 AI는 DDL의 주석(COMMENT)이나 물리명을 그대로 쓰고, 그 이름을 "사전 등록 필요 목록"으로 따로 알려 준다.
2. **붙여넣는 곳:** 코드 모드 편집기(기존 작업 모드)에 붙여넣고 "적용"한다. 내부 플래그의 통합 편집 패널은 아직 "테이블/컬럼 추가"를 지원하지 않으므로(S4-b 예정) 새 테이블 생성에는 쓸 수 없다.
3. **DDL을 그대로 가져오기만 하면 되는 경우**(사전과 무관하게 물리명 그대로)는 AI 없이 툴바의 **DDL 가져오기**가 더 정확하다. 이 프롬프트는 "논리명 DSL로 정리하고 싶을 때"용이다.
4. AI 출력은 반드시 **사람이 검토**한다(특히 FK 방향, 타입, 사전 매핑).

---

## DSL 문법 규칙 (요약)

```
Table <테이블논리명> {
  <컬럼논리명> [> <부모테이블논리명>.<부모컬럼논리명>] [:<도메인논리명>] [::<물리타입>] [[PK, AI, NN]]
}
```

- 키워드는 정확히 `Table` (대문자 T). 테이블마다 `{ ... }` 블록이 있어야 하며 중괄호가 어긋나면 구문 에러.
- 컬럼은 한 줄에 하나. 순서는 `이름` → `> FK` → `:도메인` → `::타입` → `[옵션]`.
- 주석은 `//` 이후.
- `:도메인`과 `::타입`은 **동시에 쓸 수 없다.** DDL에는 도메인 정보가 없으므로 기본은 `::타입`만 쓴다.
- 옵션: `PK`(기본키), `AI`(자동증가, PK 컬럼에만 의미), `NN`(NOT NULL). PK 컬럼은 `NN`을 생략한다(PK면 자동으로 NOT NULL).
- 복합 PK는 해당하는 모든 컬럼에 각각 `[PK]`를 붙인다.
- FK는 컬럼 하나당 참조 하나(`> 부모테이블.부모컬럼`). 복합 FK는 컬럼별로 각각 참조를 쓴다. 자기 참조도 가능하다. 부모 테이블은 같은 입력 안에 선언돼 있어야 하며 선언 순서는 상관없다.
- 식별자에 공백이 있으면 작은따옴표로 감싼다(예: `'사용자 이름'`). 식별자에 `.`, `>`, `:`, `[`, `]`, `//`, 줄바꿈은 쓰지 않는다.
- 컬럼 논리명은 **같은 테이블 안에서 중복되면 안 된다**(논리명 중복, 물리명 중복 모두 에러로 검증됨). 테이블 논리명은 에러로 검증되지는 않지만 FK 참조가 모호해지므로 문서 안에서 유일하게 쓴다(권장).
- `::타입` 형식: 영문자로 시작하는 단어(공백 가능) + 선택적 괄호. 예: `BIGINT`, `VARCHAR(100)`, `DECIMAL(15,2)`, `TIMESTAMP WITH TIME ZONE`, `DOUBLE PRECISION`. 배열 타입(`INT[]`)처럼 대괄호가 들어가는 타입은 쓸 수 없다.
- DSL에서 표현되지 않는 DDL 요소(`UNIQUE`, `CHECK`, `DEFAULT`, `INDEX`, `TRIGGER`, `VIEW`, `SEQUENCE`, 파티션 등)는 **삭제**한다.

## 변환 규칙 (DDL → DSL)

| DDL | DSL |
|---|---|
| `COMMENT ON TABLE` / 테이블 `COMMENT` | `Table` 뒤 이름(논리명). 없으면 사전 매핑, 그것도 없으면 물리명 |
| `COMMENT ON COLUMN` / 컬럼 `COMMENT` | 컬럼 이름(논리명). 없으면 사전 매핑, 그것도 없으면 물리명 |
| 컬럼 데이터 타입 | `::타입` (원문 타입을 대문자로, 길이/정밀도 유지) |
| `PRIMARY KEY` (인라인·테이블 레벨) | 해당 컬럼에 `PK` |
| `AUTO_INCREMENT` / `IDENTITY` / `SERIAL` / `GENERATED ... AS IDENTITY` | `AI` (SERIAL 계열 타입 치환은 이 프롬프트의 관례: `SERIAL`→`::INTEGER`, `BIGSERIAL`→`::BIGINT`) |
| `NOT NULL` | `NN` (PK 컬럼은 생략) |
| `REFERENCES` / `FOREIGN KEY` / `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` | 자식 컬럼 줄에 `> 부모논리명.부모컬럼논리명` |
| `schema.table` | 마지막 식별자(`table`)만 사용 |
| 따옴표/백틱 식별자 | 따옴표·백틱 제거 |

이름 결정 순서(테이블·컬럼 공통):
1. 데이터 사전 목록이 주어졌고 **물리명이 일치하는 용어**가 있으면 그 **논리명**을 쓴다.
2. 사전에 없고 DDL에 COMMENT가 있으면 **COMMENT 값**(공백·특수문자 정리)을 쓴다.
3. 둘 다 없으면 **물리명 그대로** 쓴다.
2·3으로 정한 이름은 모두 "사전 등록 필요 목록"에 적는다(사전에 등록돼야 적용 에러가 사라진다).
FK에서 부모 테이블·컬럼을 가리킬 때는 **그 테이블/컬럼에 위 규칙으로 정한 이름과 정확히 같은 문자열**을 써야 한다.

---

## 프롬프트 (그대로 복사해서 사용)

아래 `{{...}}` 부분만 채운다. 사전 목록이 없으면 해당 블록을 `없음`으로 둔다.

```text
당신은 SQL DDL을 "Smart ERD DSL"로 변환하는 변환기입니다. 아래 규칙을 정확히 지키고, 규칙에 없는 것은 추측하지 말고 "확인 필요"에 적으세요.

## 출력 형식
다음 3개 섹션만, 이 순서로 출력합니다.
1) ```dsl 코드블록 — 변환 결과 DSL만 (설명·번호 매기기 금지)
2) "사전 등록 필요 목록" — 사전에서 찾지 못해 COMMENT 또는 물리명을 그대로 쓴 이름. 표: 구분(테이블/컬럼) | DSL에 쓴 이름 | 원래 물리명 | 근거(COMMENT/물리명)
3) "확인 필요" — 지원되지 않아 버린 요소(UNIQUE/CHECK/DEFAULT/INDEX 등), 모호했던 판단, 변환하지 못한 문장. 없으면 "없음"

## DSL 문법
Table <테이블논리명> {
  <컬럼논리명> [> <부모테이블논리명>.<부모컬럼논리명>] [:<도메인논리명>] [::<물리타입>] [[PK, AI, NN]]
}
- 키워드는 정확히 `Table`. 테이블마다 { } 블록. 주석은 // 로 시작.
- 컬럼은 한 줄에 하나. 순서: 이름 → `> FK` → `:도메인` → `::타입` → `[옵션]`.
- 도메인 정보는 DDL에 없으므로 `:도메인`은 쓰지 말고 `::타입`만 씁니다. 둘을 동시에 쓰면 안 됩니다.
- 옵션은 PK, AI, NN 세 가지뿐. PK 컬럼에는 NN을 쓰지 않습니다. 복합 PK는 해당 컬럼 모두에 [PK]. AI는 자동증가(IDENTITY/AUTO_INCREMENT/SERIAL) 컬럼에만.
- FK는 컬럼 하나당 참조 하나. 복합 FK는 컬럼별로 각각 `> 부모.컬럼`. 부모 테이블은 같은 출력 안에 있어야 합니다.
- 식별자에 공백이 있으면 작은따옴표로 감쌉니다. 식별자에 . > : [ ] // 줄바꿈은 쓰지 않습니다(대체: 밑줄 또는 제거).
- 같은 테이블 안에서 컬럼 이름이 중복되면 안 되고(에러), 테이블 이름도 FK 참조가 모호해지지 않도록 전체에서 유일해야 합니다. 중복되면 뒤쪽 이름에 구분 접미사를 붙이고 "확인 필요"에 적습니다.
- ::타입은 영문자로 시작하는 단어(공백 허용) + 선택적 괄호만 허용: BIGINT, VARCHAR(100), DECIMAL(15,2), TIMESTAMP WITH TIME ZONE 처럼. 대괄호가 들어가는 배열 타입은 쓰지 말고 가장 가까운 타입(예: TEXT/JSONB)으로 바꾸고 "확인 필요"에 적습니다.
- UNIQUE, CHECK, DEFAULT, INDEX, TRIGGER, VIEW, SEQUENCE, 파티션 등 DSL에 없는 요소는 버리고 "확인 필요"에 적습니다.

## 변환 규칙
- 타입: 원문 타입을 대문자로, 길이·정밀도는 유지. SERIAL → ::INTEGER [AI], BIGSERIAL → ::BIGINT [AI], GENERATED ... AS IDENTITY → AI.
- NOT NULL → NN (PK 컬럼은 생략). PRIMARY KEY(인라인·테이블 레벨) → PK. AUTO_INCREMENT → AI.
- REFERENCES / FOREIGN KEY / ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY → 자식 컬럼 줄에 `> 부모논리명.부모컬럼논리명`.
- schema.table 은 마지막 식별자만 사용. 따옴표·백틱은 제거.
- 이름 결정 순서(테이블·컬럼 공통):
  1) 아래 "데이터 사전"에 물리명이 일치하는 용어가 있으면 그 논리명을 사용
  2) 없고 DDL에 COMMENT(COMMENT ON ... / MySQL COMMENT)가 있으면 COMMENT 값을 사용(앞뒤 공백 제거, 내부 공백은 밑줄 대신 그대로 두되 작은따옴표로 감쌈)
  3) 둘 다 없으면 물리명 그대로
  2·3으로 정한 이름은 모두 "사전 등록 필요 목록"에 적습니다.
- FK의 부모 테이블·컬럼은 그 테이블/컬럼에 위 순서로 정한 이름과 한 글자도 다르지 않게 같아야 합니다.
- 테이블은 입력 DDL의 등장 순서를 유지하고, 컬럼도 DDL 선언 순서를 유지합니다.
- 입력에 없는 테이블·컬럼·관계를 만들어 내지 않습니다. 확실하지 않은 것은 추측하지 말고 "확인 필요"에 적습니다.

## 출력 전 자체 점검 (출력하지 말고 내부에서 수행)
- 모든 Table 블록의 중괄호가 닫혔는가
- FK가 가리키는 테이블·컬럼 이름이 실제 출력에 존재하고 철자가 같은가
- :도메인과 ::타입을 같은 줄에 쓰지 않았는가
- 같은 테이블 안 컬럼 이름 중복, 전체 테이블 이름 중복이 없는가
- 허용되지 않는 문자(. > : [ ] //)가 식별자에 없는가

## DBMS
{{PostgreSQL | MySQL | Oracle | SQL Server | 기타}}

## 데이터 사전 (물리명 → 논리명 [도메인/타입]). 없으면 "없음"
{{예:
users          → 사용자
user_id        → 사용자아이디   (BIGINT)
created_at     → 생성일시       (TIMESTAMP)
}}

## 입력 DDL
{{DDL 전체 붙여넣기}}
```

---

## 변환 결과 확인 절차

1. 코드 모드 편집기에 DSL을 붙여넣으면 오류 위치가 에디터 마커로 표시된다.
2. `사전에 없는 논리명` 에러는 AI가 준 "사전 등록 필요 목록"을 사전(용어/단어)에 등록하면 해결된다. 단어 조합으로 물리명이 만들어지므로 용어 등록 시 단어가 필요할 수 있다.
3. `선언되지 않은 테이블/컬럼`(FK 에러)은 FK가 가리키는 이름이 부모의 실제 이름과 다른 경우다. 프롬프트의 "FK 이름 일치" 규칙을 다시 확인한다.
4. 에러 0건이 되면 적용한다. 적용 전에 테이블·컬럼 수, PK, FK 개수를 원본 DDL과 대조한다.

## 예시

입력 DDL (PostgreSQL):

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

기대 출력(사전 없음, COMMENT 사용):

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

사전 등록 필요 목록: 팀, 사용자, 아이디, 이름, 팀아이디, 메모 (모두 COMMENT 근거).
