import type * as Monaco from 'monaco-editor';
import type { Term, Domain } from '@/types/dictionary';
import { DSL_TABLE_KEYWORD, DSL_COLUMN_OPTIONS, DSL_TYPE_SUGGESTIONS } from '@/lib/dsl-keywords';

/** DSL 커스텀 언어 ID */
export const DSL_LANGUAGE_ID = 'smart-erd-dsl';
/** 자동완성에서 빠른 용어 등록을 실행하는 커맨드 ID */
export const DSL_QUICK_REGISTER_TERM_COMMAND_ID = 'smart-erd.dsl.quickRegisterTerm';
/** 자동완성에서 빠른 도메인 등록을 실행하는 커맨드 ID */
export const DSL_QUICK_REGISTER_DOMAIN_COMMAND_ID = 'smart-erd.dsl.quickRegisterDomain';

/** `Table ` 뒤 컨텍스트 감지 정규식 */
const TABLE_AFTER_REGEX = new RegExp(`^\\s*${DSL_TABLE_KEYWORD}\\s+\\S*$`);
/** Table 키워드 행 시작 감지 정규식 (블록 판정용) */
const TABLE_LINE_REGEX = new RegExp(`^${DSL_TABLE_KEYWORD}\\s+`);
/** Table 키워드 소문자 (자동완성 필터링용) */
const TABLE_KEYWORD_LOWER = DSL_TABLE_KEYWORD.toLowerCase();

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

  /** Table 키워드 정규식 (상태 전환 트리거) */
  const tableKeywordRegex = new RegExp(`\\b${DSL_TABLE_KEYWORD}\\b`);
  /** 옵션 키워드 정규식 (PK|AI|NN) */
  const optionsRegex = new RegExp(DSL_COLUMN_OPTIONS.join('|'));

  monaco.languages.setMonarchTokensProvider(DSL_LANGUAGE_ID, {
    defaultToken: 'identifier',

    tokenizer: {
      root: [
        // 한줄 주석
        [/\/\/.*$/, 'comment'],
        // Table 키워드
        [
          tableKeywordRegex,
          {
            token: 'keyword',
            next: '@tableName',
          },
        ],
        // 옵션 블록
        [/\[/, { token: 'delimiter.square', next: '@options' }],
        // 물리 타입 직접 지정
        [/::([^[]+)/, 'type'],
        // 도메인 지정
        [/:(?!:)(\S+)/, 'type'],
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
        [optionsRegex, 'keyword.option'],
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

/** DSL 자동완성에서 사용하는 빠른 등록 액션 */
export interface DslCompletionQuickActions {
  /** 용어 빠른 등록 콜백 */
  onQuickRegisterTerm?: (logicalName: string) => void;
  /** 도메인 빠른 등록 콜백 */
  onQuickRegisterDomain?: (logicalName: string) => void;
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
  quickActions?: DslCompletionQuickActions,
): Monaco.languages.CompletionItemProvider {
  /**
   * 빠른 등록 자동완성에 표시할 대상 텍스트를 포맷한다.
   *
   * @param logicalName 입력한 논리명
   * @returns 표시용 텍스트
   */
  const formatQuickRegisterTarget = (logicalName: string): string =>
    logicalName.trim() ? `'${logicalName.trim()}'` : '현재 입력값';

  /**
   * 자동완성 목록에 빠른 용어 등록 항목을 추가한다.
   *
   * @param suggestions 자동완성 목록
   * @param position 현재 커서 위치
   * @param logicalName 초기 논리명
   */
  const pushQuickTermSuggestion = (
    suggestions: Monaco.languages.CompletionItem[],
    position: Monaco.Position,
    logicalName: string,
  ) => {
    if (!quickActions?.onQuickRegisterTerm) {
      return;
    }
    const targetLabel = formatQuickRegisterTarget(logicalName);
    suggestions.unshift({
      label: '용어 등록',
      kind: monaco.languages.CompletionItemKind.Reference,
      detail: `${targetLabel} 용어를 사전에 추가`,
      insertText: '',
      range: new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column,
      ),
      filterText: `${logicalName} 용어 신규 등록`,
      sortText: '0000',
      command: {
        id: DSL_QUICK_REGISTER_TERM_COMMAND_ID,
        title: '용어 등록',
        arguments: [logicalName],
      },
    });
  };

  /**
   * 자동완성 목록에 빠른 도메인 등록 항목을 추가한다.
   *
   * @param suggestions 자동완성 목록
   * @param position 현재 커서 위치
   * @param logicalName 초기 논리명
   */
  const pushQuickDomainSuggestion = (
    suggestions: Monaco.languages.CompletionItem[],
    position: Monaco.Position,
    logicalName: string,
  ) => {
    if (!quickActions?.onQuickRegisterDomain) {
      return;
    }
    const targetLabel = formatQuickRegisterTarget(logicalName);
    suggestions.unshift({
      label: '도메인 등록',
      kind: monaco.languages.CompletionItemKind.Reference,
      detail: `${targetLabel} 도메인을 사전에 추가`,
      insertText: '',
      range: new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column,
      ),
      filterText: `${logicalName} 도메인 신규 등록`,
      sortText: '0000',
      command: {
        id: DSL_QUICK_REGISTER_DOMAIN_COMMAND_ID,
        title: '도메인 등록',
        arguments: [logicalName],
      },
    });
  };

  return {
    triggerCharacters: ['[', ':', '>', ','],

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

      // 0. 행 시작 + 테이블 블록 외부 → Table 키워드 자동완성
      if (/^\s*\S*$/.test(textUntilPosition) && !isInsideTableBlock(model, position.lineNumber)) {
        const typed = word.word.toLowerCase();
        if (typed.length > 0 && TABLE_KEYWORD_LOWER.startsWith(typed)) {
          suggestions.push({
            label: DSL_TABLE_KEYWORD,
            kind: monaco.languages.CompletionItemKind.Keyword,
            detail: `${DSL_TABLE_KEYWORD} 테이블명 { ... }`,
            insertText: `${DSL_TABLE_KEYWORD} `,
            range,
          });
          return { suggestions };
        }
      }

      // 1. `[` 또는 `,` 뒤 → PK, AI, NN 옵션
      if (/\[\s*$/.test(textUntilPosition) || /,\s*$/.test(textUntilPosition)) {
        // 이미 사용된 옵션 감지
        const bracketIdx = lineContent.lastIndexOf('[');
        const optionsUsed = bracketIdx >= 0 ? lineContent.substring(bracketIdx).toUpperCase() : '';

        for (const opt of DSL_COLUMN_OPTIONS) {
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

      // 2. `::` 뒤 → 타입 스니펫
      if (/::\s*\S*$/.test(textUntilPosition) && !textUntilPosition.includes('//')) {
        for (const snippet of DSL_TYPE_SUGGESTIONS) {
          suggestions.push({
            label: snippet,
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: snippet,
            range,
          });
        }
        return { suggestions };
      }

      // 3. `:` 뒤(단일 콜론) → Domain 목록
      if (
        /(^|[^:]):\s*\S*$/.test(textUntilPosition) &&
        !/::\s*\S*$/.test(textUntilPosition) &&
        !textUntilPosition.includes('//')
      ) {
        const domainInput =
          textUntilPosition.match(/(^|[^:]):\s*([^\s[]*)$/)?.[2]?.trim() ?? word.word.trim();
        for (const domain of domains) {
          suggestions.push({
            label: domain.logicalName,
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            detail: domain.physicalType,
            insertText: domain.logicalName,
            range,
          });
        }
        pushQuickDomainSuggestion(suggestions, position, domainInput);
        return { suggestions };
      }

      // 4. `>` 뒤 → 테이블.컬럼 자동완성
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

      // 5. `Table ` 뒤 → Term 검색
      if (TABLE_AFTER_REGEX.test(textUntilPosition)) {
        const termInput = word.word.trim();
        for (const term of terms) {
          suggestions.push({
            label: term.logicalName,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: term.physicalName,
            insertText: term.logicalName,
            range,
          });
        }
        pushQuickTermSuggestion(suggestions, position, termInput);
        return { suggestions };
      }

      // 6. 테이블 블록 내부 행 시작 → Term 검색 (컬럼 논리명)
      if (isInsideTableBlock(model, position.lineNumber)) {
        const termInput = word.word.trim();
        for (const term of terms) {
          suggestions.push({
            label: term.logicalName,
            kind: monaco.languages.CompletionItemKind.Field,
            detail: `${term.physicalName}${term.domainLogicalName ? ` (${term.domainLogicalName})` : ''}`,
            insertText: term.logicalName,
            range,
          });
        }
        pushQuickTermSuggestion(suggestions, position, termInput);
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
    if (text.endsWith('{') || TABLE_LINE_REGEX.test(text)) {
      depth++;
      if (depth > 0) {
        return true;
      }
    }
  }
  return false;
}
