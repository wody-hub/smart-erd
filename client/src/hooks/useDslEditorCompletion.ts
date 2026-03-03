import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type * as Monaco from 'monaco-editor';
import {
  DSL_TABLE_KEYWORD,
  DSL_COLUMN_OPTIONS,
  DSL_TYPE_SUGGESTIONS,
  DSL_TABLE_AFTER_REGEX,
  DSL_TABLE_TERM_CAPTURE_REGEX,
  DSL_TABLE_LINE_REGEX,
  DSL_DOMAIN_CONTEXT_REGEX,
  DSL_DOMAIN_CAPTURE_REGEX,
  DSL_EXPLICIT_TYPE_CONTEXT_REGEX,
  DSL_FK_CONTEXT_REGEX,
  DSL_FK_CAPTURE_REGEX,
  DSL_BLOCK_TERM_CAPTURE_REGEX,
} from '@/lib/dsl-keywords';
import type { DslError, DslParseResult } from '@/lib/dsl-parser';
import type { Domain, Term } from '@/types/dictionary';

/** 보조 팝업 항목 유형 */
export type AssistPopupItemType = 'insert' | 'registerTerm' | 'registerDomain';

/** 보조 팝업 개별 항목 */
export interface AssistPopupItem {
  /** 항목 고유 ID */
  id: string;
  /** 항목 유형 */
  type: AssistPopupItemType;
  /** 표시 라벨 */
  label: string;
  /** 보조 설명 */
  description?: string;
  /** 대상 행 번호 (1-based) */
  lineNumber: number;
  /** 치환 시작 컬럼 (1-based) */
  startColumn: number;
  /** 치환 종료 컬럼 (1-based) */
  endColumn: number;
  /** 삽입 텍스트 */
  insertText?: string;
  /** 연관 이름 (용어/도메인 등록 시 사용) */
  name?: string;
}

/** useDslEditorCompletion 훅 옵션 */
interface UseDslEditorCompletionOptions {
  /** 용어 사전 목록 */
  terms: Term[];
  /** 도메인 사전 목록 */
  domains: Domain[];
  /** DSL 파싱 결과 (진단 정보 포함) */
  parseResult: DslParseResult | null;
}

/** useDslEditorCompletion 훅 반환 타입 */
interface UseDslEditorCompletionReturn {
  /**
   * 현재 커서 위치에서 보조 팝업 항목을 빌드한다.
   *
   * @param model     Monaco 텍스트 모델
   * @param position  커서 위치
   * @param includeContextCompletions 컨텍스트 기반 자동완성 포함 여부
   * @returns 보조 팝업 항목 배열
   */
  buildAssistItems: (
    model: Monaco.editor.ITextModel,
    position: Monaco.Position,
    includeContextCompletions: boolean,
  ) => AssistPopupItem[];

  /**
   * 현재 위치에서 빠른 등록 가능한 진단을 찾는다.
   *
   * @param diagnostics DSL 진단 목록
   * @param line        1-based 행
   * @param column      1-based 열
   * @returns 빠른 등록 대상 진단
   */
  findQuickRegisterDiagnostic: (
    diagnostics: DslError[],
    line: number,
    column: number,
  ) => DslError | null;
}

type MatchScore = readonly [number, number, number, number];

/**
 * 현재 행이 Table {} 블록 내부인지 판별한다.
 *
 * @param model   Monaco 텍스트 모델
 * @param lineNum 검사할 행 번호
 * @returns 블록 내부이면 true
 */
function isInsideTableBlock(model: Monaco.editor.ITextModel, lineNum: number): boolean {
  let depth = 0;
  for (let i = lineNum - 1; i >= 1; i--) {
    const text = model.getLineContent(i).trim();
    if (text === '}') depth--;
    if (text.endsWith('{') || DSL_TABLE_LINE_REGEX.test(text)) {
      depth++;
      if (depth > 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 검색어(query)와 후보(candidate)의 부분 일치 점수를 계산한다.
 *
 * @param candidate 후보 문자열
 * @param query     사용자 입력 문자열
 * @returns 일치 점수. 일치하지 않으면 null
 */
function scoreMatch(candidate: string, query: string): MatchScore | null {
  const normalizedCandidate = candidate.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const index = normalizedCandidate.indexOf(normalizedQuery);
  if (index < 0) {
    return null;
  }
  const startsWith = index === 0 ? 0 : 1;
  const exact = normalizedCandidate === normalizedQuery ? 0 : 1;
  return [exact, startsWith, index, normalizedCandidate.length] as const;
}

/**
 * DSL 에디터 자동완성 / 보조 팝업 항목 빌드 로직을 제공하는 훅.
 *
 * Monaco 에디터의 커서 위치와 사전 데이터를 기반으로
 * 용어/도메인/키워드/FK 등의 자동완성 후보를 생성한다.
 *
 * @param options.terms       용어 사전 목록
 * @param options.domains     도메인 사전 목록
 * @param options.parseResult DSL 파싱 결과
 * @returns 보조 팝업 항목 빌드 함수 및 진단 검색 함수
 */
export function useDslEditorCompletion({
  terms,
  domains,
  parseResult,
}: UseDslEditorCompletionOptions): UseDslEditorCompletionReturn {
  const { t } = useTranslation();

  /** 현재 위치에서 빠른 등록 가능한 진단을 찾는다. */
  const findQuickRegisterDiagnostic = useCallback(
    (diagnostics: DslError[], line: number, column: number): DslError | null => {
      for (const diag of diagnostics) {
        if (diag.line !== line) {
          continue;
        }
        const endInclusive = Math.max(diag.startColumn, diag.endColumn - 1);
        if (column < diag.startColumn || column > endInclusive) {
          continue;
        }
        if (diag.messageKey === 'erd.dsl.error.unknownTerm' && diag.messageArgs?.name?.trim()) {
          return diag;
        }
        if (diag.messageKey === 'erd.dsl.error.unknownDomain' && diag.messageArgs?.name?.trim()) {
          return diag;
        }
      }
      return null;
    },
    [],
  );

  /** 커서 컨텍스트를 기반으로 보조 팝업 항목을 계산한다. */
  const buildAssistItems = useCallback(
    (
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      includeContextCompletions: boolean,
    ): AssistPopupItem[] => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textUntilPosition = lineContent.substring(0, position.column - 1);
      const word = model.getWordUntilPosition(position);
      const defaultStart = word.startColumn;
      const defaultEnd = word.endColumn;
      const items: AssistPopupItem[] = [];
      const seen = new Set<string>();

      /**
       * 보조 팝업 후보 목록에 항목을 중복 없이 추가한다.
       *
       * @param item 추가할 보조 팝업 항목
       */
      const addItem = (item: AssistPopupItem) => {
        if (seen.has(item.id)) {
          return;
        }
        seen.add(item.id);
        items.push(item);
      };

      /**
       * 용어 미등록 컨텍스트에 빠른 용어 등록 액션을 추가한다.
       *
       * @param name 후보 용어명
       */
      const addRegisterTerm = (name: string) => {
        const normalized = name.trim();
        if (!normalized) {
          return;
        }
        addItem({
          id: `register-term:${normalized}`,
          type: 'registerTerm',
          label: t('erd.dsl.assist.registerTerm'),
          description: t('erd.dsl.errorGuide.quickAction.registerTerm', { name: normalized }),
          lineNumber: position.lineNumber,
          startColumn: position.column,
          endColumn: position.column,
          name: normalized,
        });
      };

      /**
       * 도메인 미등록 컨텍스트에 빠른 도메인 등록 액션을 추가한다.
       *
       * @param name 후보 도메인명
       */
      const addRegisterDomain = (name: string) => {
        const normalized = name.trim();
        if (!normalized) {
          return;
        }
        addItem({
          id: `register-domain:${normalized}`,
          type: 'registerDomain',
          label: t('erd.dsl.assist.registerDomain'),
          description: t('erd.dsl.errorGuide.quickAction.registerDomain', { name: normalized }),
          lineNumber: position.lineNumber,
          startColumn: position.column,
          endColumn: position.column,
          name: normalized,
        });
      };

      /**
       * 텍스트 치환형 자동완성 항목을 추가한다.
       *
       * @param id          항목 ID
       * @param label       표시 라벨
       * @param insertText  삽입 텍스트
       * @param description 보조 설명
       * @param startColumn 치환 시작 컬럼
       * @param endColumn   치환 종료 컬럼
       */
      const addInsert = (
        id: string,
        label: string,
        insertText: string,
        description?: string,
        startColumn = defaultStart,
        endColumn = defaultEnd,
      ) => {
        addItem({
          id,
          type: 'insert',
          label,
          description,
          lineNumber: position.lineNumber,
          startColumn,
          endColumn,
          insertText,
        });
      };

      const diagnosticAtCursor =
        parseResult?.diagnostics &&
        (findQuickRegisterDiagnostic(
          parseResult.diagnostics,
          position.lineNumber,
          position.column - 1,
        ) ||
          findQuickRegisterDiagnostic(
            parseResult.diagnostics,
            position.lineNumber,
            position.column,
          ));
      if (diagnosticAtCursor?.messageKey === 'erd.dsl.error.unknownTerm') {
        addRegisterTerm(diagnosticAtCursor.messageArgs?.name ?? '');
      } else if (diagnosticAtCursor?.messageKey === 'erd.dsl.error.unknownDomain') {
        addRegisterDomain(diagnosticAtCursor.messageArgs?.name ?? '');
      }

      if (!includeContextCompletions) {
        return items;
      }

      if (/::\s*\S*$/.test(textUntilPosition) && !textUntilPosition.includes('//')) {
        for (const type of DSL_TYPE_SUGGESTIONS) {
          addInsert(`type:${type}`, type, type, t('erd.dsl.assist.typeSuggestion'));
        }
      }

      if (/\[\s*$/.test(textUntilPosition) || /,\s*$/.test(textUntilPosition)) {
        const bracketIdx = lineContent.lastIndexOf('[');
        const optionsUsed = bracketIdx >= 0 ? lineContent.substring(bracketIdx).toUpperCase() : '';
        for (const option of DSL_COLUMN_OPTIONS) {
          if (!optionsUsed.includes(option)) {
            addInsert(`option:${option}`, option, option, t('erd.dsl.assist.optionSuggestion'));
          }
        }
      }

      if (
        DSL_DOMAIN_CONTEXT_REGEX.test(textUntilPosition) &&
        !DSL_EXPLICIT_TYPE_CONTEXT_REGEX.test(textUntilPosition) &&
        !textUntilPosition.includes('//')
      ) {
        const domainInputRaw =
          textUntilPosition.match(DSL_DOMAIN_CAPTURE_REGEX)?.[2] ?? word.word.trim();
        const domainInput = domainInputRaw.trim();
        const normalizedDomainInput = domainInput.toLowerCase();
        const replaceStart = Math.max(1, position.column - domainInputRaw.length);
        const rankedDomains: Array<{ domain: (typeof domains)[number]; score: MatchScore }> = [];
        for (const domain of domains) {
          if (!normalizedDomainInput) {
            rankedDomains.push({ domain, score: [1, 1, 0, domain.logicalName.length] });
            continue;
          }
          const logicalScore = scoreMatch(domain.logicalName, normalizedDomainInput);
          const physicalTypeScore = scoreMatch(domain.physicalType, normalizedDomainInput);
          const score = logicalScore ?? physicalTypeScore;
          if (score) {
            rankedDomains.push({ domain, score });
          }
        }
        const matchedDomains = rankedDomains
          .sort((a, b) => {
            for (let i = 0; i < a.score.length; i++) {
              if (a.score[i] !== b.score[i]) {
                return a.score[i] - b.score[i];
              }
            }
            return a.domain.logicalName.localeCompare(b.domain.logicalName);
          })
          .map((item) => item.domain);

        for (const domain of matchedDomains) {
          addInsert(
            `domain:${domain.id}`,
            domain.logicalName,
            domain.logicalName,
            domain.physicalType,
            replaceStart,
            position.column,
          );
        }
        addRegisterDomain(domainInput || diagnosticAtCursor?.messageArgs?.name || '');
        return items;
      }

      if (DSL_FK_CONTEXT_REGEX.test(textUntilPosition)) {
        const parsedTables = parseResult?.result.tables.map((table) => ({
          logicalName: table.logicalTableName ?? table.name,
          columns: table.columns.map((col) => col.logicalName ?? col.name),
        }));
        const afterArrow = textUntilPosition.match(DSL_FK_CAPTURE_REGEX)?.[1] ?? '';
        const dotIdx = afterArrow.indexOf('.');
        let hasFkSuggestions = false;
        if (dotIdx < 0) {
          const tableStart = Math.max(1, position.column - afterArrow.length);
          for (const table of parsedTables ?? []) {
            hasFkSuggestions = true;
            addInsert(
              `fk-table:${table.logicalName}`,
              table.logicalName,
              table.logicalName,
              undefined,
              tableStart,
              position.column,
            );
          }
        } else {
          const tableName = afterArrow.substring(0, dotIdx).trim();
          const colInput = afterArrow.substring(dotIdx + 1);
          const colStart = Math.max(1, position.column - colInput.length);
          const table = parsedTables?.find((item) => item.logicalName === tableName);
          for (const col of table?.columns ?? []) {
            hasFkSuggestions = true;
            addInsert(`fk-col:${tableName}.${col}`, col, col, undefined, colStart, position.column);
          }
        }
        if (hasFkSuggestions) {
          return items;
        }
      }

      const inBlock = isInsideTableBlock(model, position.lineNumber);
      if (/^\s*\S*$/.test(textUntilPosition) && !inBlock) {
        const typed = word.word.toLowerCase();
        if (typed.length > 0 && DSL_TABLE_KEYWORD.toLowerCase().startsWith(typed)) {
          addInsert(
            'keyword:table',
            DSL_TABLE_KEYWORD,
            `${DSL_TABLE_KEYWORD} `,
            t('erd.dsl.assist.tableKeyword'),
          );
        }
      }

      if (DSL_TABLE_AFTER_REGEX.test(textUntilPosition) || inBlock) {
        const termInputRaw = DSL_TABLE_AFTER_REGEX.test(textUntilPosition)
          ? (textUntilPosition.match(DSL_TABLE_TERM_CAPTURE_REGEX)?.[1] ?? word.word.trim())
          : (textUntilPosition.match(DSL_BLOCK_TERM_CAPTURE_REGEX)?.[1] ?? word.word.trim());
        const termInput = termInputRaw.trim();
        const termStart = Math.max(1, position.column - termInputRaw.length);
        const normalizedTermInput = termInput.toLowerCase();
        const rankedTerms: Array<{ term: (typeof terms)[number]; score: MatchScore }> = [];
        for (const term of terms) {
          if (!normalizedTermInput) {
            rankedTerms.push({ term, score: [1, 1, 0, term.logicalName.length] });
            continue;
          }
          const logicalScore = scoreMatch(term.logicalName, normalizedTermInput);
          const physicalScore = scoreMatch(term.physicalName, normalizedTermInput);
          const score = logicalScore ?? physicalScore;
          if (score) {
            rankedTerms.push({ term, score });
          }
        }
        const matchedTerms = rankedTerms
          .sort((a, b) => {
            for (let i = 0; i < a.score.length; i++) {
              if (a.score[i] !== b.score[i]) {
                return a.score[i] - b.score[i];
              }
            }
            return a.term.logicalName.localeCompare(b.term.logicalName);
          })
          .map((item) => item.term);

        for (const term of matchedTerms) {
          addInsert(
            `term:${term.id}`,
            term.logicalName,
            term.logicalName,
            `${term.physicalName}${term.domainLogicalName ? ` (${term.domainLogicalName})` : ''}`,
            termStart,
            position.column,
          );
        }
        addRegisterTerm(termInput || diagnosticAtCursor?.messageArgs?.name || '');
      }

      const registerItems = items.filter((item) => item.type !== 'insert');
      const insertItems = items.filter((item) => item.type === 'insert');
      return [...registerItems, ...insertItems].slice(0, 40);
    },
    [domains, findQuickRegisterDiagnostic, parseResult, t, terms],
  );

  return { buildAssistItems, findQuickRegisterDiagnostic };
}
