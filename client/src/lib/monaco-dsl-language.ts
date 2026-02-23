import type * as Monaco from 'monaco-editor';
import type { Term, Domain } from '@/types/dictionary';

/** DSL 커스텀 언어 ID */
export const DSL_LANGUAGE_ID = 'smart-erd-dsl';

/**
 * Monaco에 smart-erd-dsl 커스텀 언어를 등록한다.
 *
 * beforeMount 콜백에서 1회 호출한다.
 * 중복 호출해도 안전하다 (런타임에 이미 등록된 언어를 확인).
 *
 * @param monaco Monaco 네임스페이스
 */
export function registerDslLanguage(monaco: typeof Monaco): void {
  if (monaco.languages.getLanguages().some((lang) => lang.id === DSL_LANGUAGE_ID)) {
    return;
  }

  monaco.languages.register({ id: DSL_LANGUAGE_ID });

  monaco.languages.setMonarchTokensProvider(DSL_LANGUAGE_ID, {
    defaultToken: 'identifier',

    keywords: ['Table'],
    options: ['PK', 'AI', 'NN'],

    tokenizer: {
      root: [
        // 한줄 주석
        [/\/\/.*$/, 'comment'],
        // Table 키워드
        [
          /\bTable\b/,
          {
            token: 'keyword',
            next: '@tableName',
          },
        ],
        // 옵션 블록
        [/\[/, { token: 'delimiter.square', next: '@options' }],
        // 도메인 지정
        [/:(\S+)/, 'type'],
        // FK 참조 연산자
        [/>/, 'operator'],
        // 중괄호
        [/[{}]/, 'delimiter.bracket'],
        // 식별자 (논리명)
        [/\S+/, 'identifier'],
      ],

      tableName: [
        [/\s+/, ''],
        [/\S+/, { token: 'type.identifier', next: '@pop' }],
      ],

      options: [
        [/PK|AI|NN/, 'keyword.option'],
        [/,/, 'delimiter'],
        [/\s+/, ''],
        [/\]/, { token: 'delimiter.square', next: '@pop' }],
      ],
    },
  });
}

/** DSL 내 파싱된 테이블 정보 (자동완성용) */
export interface DslParsedTableRef {
  /** 테이블 논리명 */
  logicalName: string;
  /** 컬럼 논리명 목록 */
  columns: string[];
}

/**
 * DSL CompletionItemProvider를 생성한다.
 *
 * @param monaco       Monaco 네임스페이스
 * @param terms        Term 사전 목록
 * @param domains      Domain 사전 목록
 * @param tablesRef    파싱된 테이블 Ref (최신값 참조)
 * @returns CompletionItemProvider
 */
export function createDslCompletionProvider(
  monaco: typeof Monaco,
  terms: Term[],
  domains: Domain[],
  tablesRef: React.RefObject<DslParsedTableRef[]>,
): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['[', ':', '>', ',', ' '],

    provideCompletionItems(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ): Monaco.languages.ProviderResult<Monaco.languages.CompletionList> {
      const lineContent = model.getLineContent(position.lineNumber);
      const textUntilPosition = lineContent.substring(0, position.column - 1);
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      );

      const suggestions: Monaco.languages.CompletionItem[] = [];

      // 1. `[` 또는 `,` 뒤 → PK, AI, NN 옵션
      if (/\[\s*$/.test(textUntilPosition) || /,\s*$/.test(textUntilPosition)) {
        // 이미 사용된 옵션 감지
        const bracketIdx = lineContent.lastIndexOf('[');
        const optionsUsed = bracketIdx >= 0 ? lineContent.substring(bracketIdx).toUpperCase() : '';

        for (const opt of ['PK', 'AI', 'NN']) {
          if (!optionsUsed.includes(opt)) {
            suggestions.push({
              label: opt,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: opt,
              range,
            });
          }
        }

        if (suggestions.length > 0) {
          return { suggestions };
        }
      }

      // 2. `:` 뒤 → Domain 목록
      if (/:\s*\S*$/.test(textUntilPosition) && !textUntilPosition.includes('//')) {
        for (const domain of domains) {
          suggestions.push({
            label: domain.logicalName,
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            detail: domain.physicalType,
            insertText: domain.logicalName,
            range,
          });
        }
        return { suggestions };
      }

      // 3. `>` 뒤 → 테이블.컬럼 자동완성
      if (/>\s*\S*$/.test(textUntilPosition)) {
        const parsedTables = tablesRef.current ?? [];
        const afterArrow = textUntilPosition.match(/>\s*(\S*)$/)?.[1] ?? '';
        const dotIdx = afterArrow.indexOf('.');

        if (dotIdx < 0) {
          // 테이블명 자동완성
          for (const table of parsedTables) {
            suggestions.push({
              label: table.logicalName,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table.logicalName,
              range,
            });
          }
        } else {
          // 테이블.컬럼명 자동완성
          const tableName = afterArrow.substring(0, dotIdx);
          const table = parsedTables.find((t) => t.logicalName === tableName);
          if (table) {
            const colWord = afterArrow.substring(dotIdx + 1);
            const colRange = new monaco.Range(
              position.lineNumber,
              position.column - colWord.length,
              position.lineNumber,
              position.column,
            );
            for (const col of table.columns) {
              suggestions.push({
                label: col,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col,
                range: colRange,
              });
            }
          }
        }

        if (suggestions.length > 0) {
          return { suggestions };
        }
      }

      // 4. `Table ` 뒤 → Term 검색
      if (/^\s*Table\s+\S*$/.test(textUntilPosition)) {
        for (const term of terms) {
          suggestions.push({
            label: term.logicalName,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: term.physicalName,
            insertText: term.logicalName,
            range,
          });
        }
        return { suggestions };
      }

      // 5. 테이블 블록 내부 행 시작 → Term 검색 (컬럼 논리명)
      if (isInsideTableBlock(model, position.lineNumber)) {
        for (const term of terms) {
          suggestions.push({
            label: term.logicalName,
            kind: monaco.languages.CompletionItemKind.Field,
            detail: `${term.physicalName}${term.domainLogicalName ? ` (${term.domainLogicalName})` : ''}`,
            insertText: term.logicalName,
            range,
          });
        }
        return { suggestions };
      }

      return { suggestions };
    },
  };
}

/**
 * 현재 행이 Table {} 블록 내부인지 판단한다.
 *
 * @param model  에디터 모델
 * @param lineNum 현재 행 번호 (1-based)
 * @returns 블록 내부 여부
 */
function isInsideTableBlock(model: Monaco.editor.ITextModel, lineNum: number): boolean {
  let depth = 0;
  for (let i = lineNum - 1; i >= 1; i--) {
    const text = model.getLineContent(i).trim();
    if (text === '}') depth--;
    if (text.endsWith('{') || /^Table\s+/.test(text)) {
      depth++;
      if (depth > 0) return true;
    }
  }
  return false;
}
