import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertTriangle, Sparkles, XCircle } from 'lucide-react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDslParse } from '@/hooks/useDslParse';
import { useApplyToErd } from '@/hooks/useApplyToErd';
import { useBidirectionalCodeSync } from '@/hooks/useBidirectionalCodeSync';
import { useCodeEditorRefresh } from '@/hooks/useCodeEditorRefresh';
import { useCodeEditorTableLock } from '@/hooks/useCodeEditorTableLock';
import { useRemoteEditLocks } from '@/hooks/useRemoteEditLocks';
import { useErdDictionary } from './ErdDictionaryContext';
import CodeEditorFooter from './CodeEditorFooter';
import DslDiagnosticGuideDialog from './DslDiagnosticGuideDialog';
import QuickTermDialog from './QuickTermDialog';
import QuickDomainDialog from './QuickDomainDialog';
import { DSL_LANGUAGE_ID, registerDslLanguage } from '@/lib/monaco-dsl-language';
import type { DslDictionary } from '@/lib/dsl-parser';
import { generateDsl } from '@/lib/dsl-generator';
import { getSyncStatusMeta } from '@/lib/sync-status-meta';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DSL_TABLE_KEYWORD, DSL_COLUMN_OPTIONS, DSL_TYPE_SUGGESTIONS } from '@/lib/dsl-keywords';
import useCanvasStore from '@/stores/useCanvasStore';
import type { TableNode, ERDEdge } from '@/types/erd';
import type { DslError } from '@/lib/dsl-parser';

/** DslCodeEditorPanel 컴포넌트의 props */
interface DslCodeEditorPanelProps {
  /** 편집 가능 여부 (VIEWER일 때 false) */
  canEdit?: boolean;
}

type AssistPopupItemType = 'insert' | 'registerTerm' | 'registerDomain';

interface AssistPopupItem {
  id: string;
  type: AssistPopupItemType;
  label: string;
  description?: string;
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  insertText?: string;
  name?: string;
}

interface AssistPopupState {
  items: AssistPopupItem[];
  selectedIndex: number;
  left: number;
  top: number;
  preview: boolean;
  visibleCount: number;
}

/** 커서 정지 시 빠른 등록 팝업 노출 대기 시간(ms) */
const QUICK_ACTION_IDLE_DELAY_MS = 700;
/** 보조 팝업 최초 노출 건수 */
const ASSIST_POPUP_INITIAL_VISIBLE = 10;
/** 보조 팝업 더보기 증가 건수 */
const ASSIST_POPUP_VISIBLE_STEP = 10;
/** `Table ` 뒤 컨텍스트 감지 정규식 */
const TABLE_AFTER_REGEX = new RegExp(`^\\s*${DSL_TABLE_KEYWORD}\\s+\\S*$`);
/** Table 키워드 행 시작 감지 정규식 (블록 판정용) */
const TABLE_LINE_REGEX = new RegExp(`^${DSL_TABLE_KEYWORD}\\s+`);

/**
 * 논리명 DSL 코드 에디터 패널.
 *
 * 논리명으로 테이블/컬럼을 선언하면 용어 사전(Term)과 도메인 사전(Domain)을
 * 자동 조회하여 물리명 + 물리타입이 적용된 ERD를 생성한다.
 *
 * @param props.canEdit 편집 가능 여부
 * @returns 논리명 DSL 에디터 패널 JSX
 */
export default function DslCodeEditorPanel({ canEdit = true }: DslCodeEditorPanelProps) {
  const { t } = useTranslation();
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();
  const { hasLocks: hasRemoteEditLocks } = useRemoteEditLocks();

  const {
    terms,
    domains,
    termByNameMap,
    domainByNameMap,
    domainMap,
    findTermById,
    findDomainById,
  } = useErdDictionary();

  /** 사전 데이터 객체 (SSOT — Ref 대입만 하므로 참조 동일성 불필요) */
  const dictionary: DslDictionary = {
    termByName: termByNameMap,
    domainByName: domainByNameMap,
    domainById: domainMap,
  };

  const { dslText, parseResult, parsing, handleDslChange } = useDslParse({ dictionary });

  const {
    handleApply,
    executeApply,
    applyParsedToErd,
    confirmOpen,
    setConfirmOpen,
    confirmDescription,
    canApply,
  } = useApplyToErd({
    canEdit,
    parseResult: parseResult?.result ?? null,
    parsing,
    policyScope: { teamId, projectId, diagramId },
  });

  /** 사전 데이터 로딩 완료 여부 (초기화 시 사전 없이 생성하면 빈 결과) */
  const hasDictionary = terms.length > 0 || domains.length > 0;

  /** ERD → DSL 생성 함수 (useCodeEditorRefresh에 전달) */
  const generate = useCallback(
    (nodes: TableNode[], edges: ERDEdge[]) =>
      generateDsl(nodes, edges, { findTermById, findDomainById }),
    [findTermById, findDomainById],
  );

  /** 현재 ERD 상태를 DSL 텍스트로 생성한다. */
  const generateFromErd = useCallback(() => {
    const { nodes, edges } = useCanvasStore.getState();
    return generate(nodes as TableNode[], edges as ERDEdge[]);
  }, [generate]);

  /** 에러 건수 */
  const errorCount = parseResult?.diagnostics.filter((d) => d.severity === 'error').length ?? 0;
  /** 경고 건수 */
  const warningCount = parseResult?.diagnostics.filter((d) => d.severity === 'warning').length ?? 0;

  const { handleUserCodeChange, handleGeneratedCodeChange, clearQueueTimeoutHold, syncStatus } =
    useBidirectionalCodeSync({
      enabled: canEdit,
      ready: hasDictionary,
      codeText: dslText,
      parsing,
      hasBlockingErrors: errorCount > 0,
      hasParsedTables: (parseResult?.result.tables.length ?? 0) > 0,
      hasRemoteEditLocks,
      onCodeTextChange: handleDslChange,
      generateCodeFromErd: generateFromErd,
      applyParsedToErd,
    });

  const handleApplyWithSyncReset = useCallback(() => {
    clearQueueTimeoutHold();
    handleApply();
  }, [clearQueueTimeoutHold, handleApply]);

  const executeApplyWithSyncReset = useCallback(() => {
    clearQueueTimeoutHold();
    executeApply();
  }, [clearQueueTimeoutHold, executeApply]);

  const { executeRefresh, handleRefresh, hasNodes, refreshConfirmOpen, setRefreshConfirmOpen } =
    useCodeEditorRefresh({
      generate,
      onGenerated: handleGeneratedCodeChange,
      currentText: dslText,
      ready: hasDictionary,
    });

  const syncStatusMeta = getSyncStatusMeta(t, syncStatus);
  /** DSL 오류 가이드에서 사용하는 빠른 용어 등록 다이얼로그 상태 */
  const [quickTermOpen, setQuickTermOpen] = useState(false);
  /** 빠른 용어 등록 초기 논리명 */
  const [quickTermInitialLogicalName, setQuickTermInitialLogicalName] = useState('');
  /** DSL 오류 가이드에서 사용하는 빠른 도메인 등록 다이얼로그 상태 */
  const [quickDomainOpen, setQuickDomainOpen] = useState(false);
  /** 빠른 도메인 등록 초기 논리명 */
  const [quickDomainInitialLogicalName, setQuickDomainInitialLogicalName] = useState('');
  /** 사전 갱신 후 1회 재파싱 플래그 */
  const pendingDictionaryReparseRef = useRef(false);
  /** 단일 보조(Assist) 팝업 상태 */
  const [assistPopup, setAssistPopup] = useState<AssistPopupState | null>(null);
  /** 최신 보조 팝업 상태(ref) */
  const assistPopupRef = useRef<AssistPopupState | null>(null);
  /** 보조 팝업 가시성 컨텍스트 키 ref */
  const assistPopupVisibleKeyRef = useRef<Monaco.editor.IContextKey<boolean> | null>(null);
  /** 보조 팝업 리스트 DOM ref */
  const assistPopupListRef = useRef<HTMLUListElement | null>(null);
  /** 커서 정지 기반 빠른 등록 팝업 타이머 */
  const idleQuickActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 커서 정지 판정용 마지막 커서 위치 */
  const idleCursorSnapshotRef = useRef<{ lineNumber: number; column: number } | null>(null);

  /** Monaco 인스턴스 ref */
  const monacoRef = useRef<typeof Monaco | null>(null);
  /** 에디터 인스턴스 ref */
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  /** Monaco mount 완료 여부 */
  const [monacoReady, setMonacoReady] = useState(false);

  /**
   * beforeMount — 언어 등록 (1회).
   *
   * @param monaco Monaco 네임스페이스
   * @returns 없음
   */
  const handleBeforeMount: BeforeMount = (monaco) => {
    registerDslLanguage(monaco);
  };

  /**
   * onMount — editorRef/monacoRef 저장 (CompletionProvider 등록은 useEffect에 위임).
   *
   * @param editor Monaco editor 인스턴스
   * @param monaco Monaco 네임스페이스
   * @returns 없음
   */
  const handleOnMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonacoReady(true);
  };

  useCodeEditorTableLock({
    enabled: canEdit,
    editorReady: monacoReady,
    editorRef,
    tableRanges: parseResult?.result.tableRanges ?? [],
    hasParseErrors: errorCount > 0,
  });

  /**
   * 진단 항목 위치로 에디터 포커스를 이동한다.
   *
   * @param diagnostic 선택된 진단 정보
   */
  const handleMoveToDiagnostic = useCallback(
    (diagnostic: { line: number; startColumn: number }) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const model = editor.getModel();
      if (!model) {
        return;
      }

      const safeLine = Math.min(Math.max(diagnostic.line, 1), model.getLineCount());
      const safeColumn = Math.min(
        Math.max(diagnostic.startColumn, 1),
        Math.max(1, model.getLineMaxColumn(safeLine)),
      );

      editor.focus();
      editor.setPosition({ lineNumber: safeLine, column: safeColumn });
      editor.revealLineInCenter(safeLine);
    },
    [],
  );

  /** 오류 가이드에서 용어 등록 요청 시 빠른 등록 다이얼로그를 연다. */
  const handleQuickRegisterTerm = useCallback((logicalName: string) => {
    setQuickTermInitialLogicalName(logicalName);
    setQuickTermOpen(true);
  }, []);

  /** 오류 가이드에서 도메인 등록 요청 시 빠른 등록 다이얼로그를 연다. */
  const handleQuickRegisterDomain = useCallback((logicalName: string) => {
    setQuickDomainInitialLogicalName(logicalName);
    setQuickDomainOpen(true);
  }, []);

  /** 사전 변경 이후 현재 DSL을 동일 텍스트로 재파싱하도록 예약한다. */
  const requestDictionaryReparse = useCallback(() => {
    pendingDictionaryReparseRef.current = true;
  }, []);

  /** 커서 정지 팝업 타이머를 정리한다. */
  const clearIdleQuickActionTimer = useCallback(() => {
    if (idleQuickActionTimerRef.current) {
      clearTimeout(idleQuickActionTimerRef.current);
      idleQuickActionTimerRef.current = null;
    }
  }, []);

  /** 보조 팝업 상태를 ref/state에 동기 반영한다. */
  const setAssistPopupSync = useCallback((next: AssistPopupState | null) => {
    assistPopupRef.current = next;
    assistPopupVisibleKeyRef.current?.set(Boolean(next));
    setAssistPopup(next);
  }, []);

  /** 보조 팝업을 닫는다. */
  const closeAssistPopup = useCallback(() => {
    setAssistPopupSync(null);
  }, [setAssistPopupSync]);

  /** 보조 팝업을 불투명(강조) 모드로 승격한다. */
  const promoteAssistPopup = useCallback(() => {
    const popup = assistPopupRef.current;
    if (!popup || !popup.preview) {
      return;
    }
    setAssistPopupSync({
      ...popup,
      preview: false,
    });
  }, [setAssistPopupSync]);

  /** 보조 팝업 선택 인덱스를 갱신한다. */
  const setAssistPopupSelectedIndex = useCallback(
    (nextIndex: number) => {
      const popup = assistPopupRef.current;
      if (!popup || popup.items.length === 0) {
        return;
      }
      const visibleLimit = Math.max(1, Math.min(popup.visibleCount, popup.items.length));
      const clamped = Math.max(0, Math.min(nextIndex, visibleLimit - 1));
      setAssistPopupSync({
        ...popup,
        selectedIndex: clamped,
      });
    },
    [setAssistPopupSync],
  );

  /** 보조 팝업 노출 건수를 확장한다. */
  const expandAssistPopupVisibleCount = useCallback(() => {
    const popup = assistPopupRef.current;
    if (!popup) {
      return;
    }
    const nextVisible = Math.min(
      popup.items.length,
      popup.visibleCount + ASSIST_POPUP_VISIBLE_STEP,
    );
    if (nextVisible === popup.visibleCount) {
      return;
    }
    setAssistPopupSync({
      ...popup,
      visibleCount: nextVisible,
    });
  }, [setAssistPopupSync]);

  /**
   * 현재 위치에서 빠른 등록 가능한 진단을 찾는다.
   *
   * @param diagnostics DSL 진단 목록
   * @param line        1-based 행
   * @param column      1-based 열
   * @returns 빠른 등록 대상 진단
   */
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

  /** 현재 행이 Table {} 블록 내부인지 판별한다. */
  const isInsideTableBlock = useCallback((model: Monaco.editor.ITextModel, lineNum: number) => {
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
  }, []);

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
       * @returns 없음
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
       * @returns 없음
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
       * @returns 없음
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
       * @param id 항목 ID
       * @param label 표시 라벨
       * @param insertText 삽입 텍스트
       * @param description 보조 설명
       * @param startColumn 치환 시작 컬럼
       * @param endColumn 치환 종료 컬럼
       * @returns 없음
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

      type MatchScore = readonly [number, number, number, number];

      /**
       * 검색어(query)와 후보(candidate)의 부분 일치 점수를 계산한다.
       *
       * @param candidate 후보 문자열
       * @param query 사용자 입력 문자열
       * @returns 일치 점수. 일치하지 않으면 null
       */
      const scoreMatch = (candidate: string, query: string): MatchScore | null => {
        const normalizedCandidate = candidate.toLowerCase();
        const normalizedQuery = query.toLowerCase();
        const index = normalizedCandidate.indexOf(normalizedQuery);
        if (index < 0) {
          return null;
        }
        const startsWith = index === 0 ? 0 : 1;
        const exact = normalizedCandidate === normalizedQuery ? 0 : 1;
        return [exact, startsWith, index, normalizedCandidate.length] as const;
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
        /(^|[^:]):\s*\S*$/.test(textUntilPosition) &&
        !/::\s*\S*$/.test(textUntilPosition) &&
        !textUntilPosition.includes('//')
      ) {
        const domainInput =
          textUntilPosition.match(/(^|[^:]):\s*([^\s[]*)$/)?.[2]?.trim() ?? word.word.trim();
        const normalizedDomainInput = domainInput.toLowerCase();
        const replaceStart = Math.max(1, position.column - domainInput.length);
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

      if (/>\s*\S*$/.test(textUntilPosition)) {
        const parsedTables = parseResult?.result.tables.map((table) => ({
          logicalName: table.logicalTableName ?? table.name,
          columns: table.columns.map((col) => col.logicalName ?? col.name),
        }));
        const afterArrow = textUntilPosition.match(/>\s*(\S*)$/)?.[1] ?? '';
        const dotIdx = afterArrow.indexOf('.');
        if (dotIdx < 0) {
          for (const table of parsedTables ?? []) {
            addInsert(`fk-table:${table.logicalName}`, table.logicalName, table.logicalName);
          }
        } else {
          const tableName = afterArrow.substring(0, dotIdx);
          const colInput = afterArrow.substring(dotIdx + 1);
          const colStart = Math.max(1, position.column - colInput.length);
          const table = parsedTables?.find((item) => item.logicalName === tableName);
          for (const col of table?.columns ?? []) {
            addInsert(`fk-col:${tableName}.${col}`, col, col, undefined, colStart, position.column);
          }
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

      if (TABLE_AFTER_REGEX.test(textUntilPosition) || inBlock) {
        const termInput = word.word.trim();
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
          );
        }
        addRegisterTerm(termInput || diagnosticAtCursor?.messageArgs?.name || '');
      }

      const registerItems = items.filter((item) => item.type !== 'insert');
      const insertItems = items.filter((item) => item.type === 'insert');
      return [...registerItems, ...insertItems].slice(0, 40);
    },
    [domains, findQuickRegisterDiagnostic, isInsideTableBlock, parseResult, t, terms],
  );

  /** 보조 팝업을 연다. */
  const openAssistPopup = useCallback(
    (options?: { position?: Monaco.Position; autoOnly?: boolean }) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const model = editor.getModel();
      if (!model) {
        return;
      }

      const position = options?.position ?? editor.getPosition();
      if (!position) {
        return;
      }

      const items = buildAssistItems(model, position, true);
      if (options?.autoOnly && !items.some((item) => item.type.startsWith('register'))) {
        return;
      }
      if (options?.autoOnly && assistPopupRef.current && !assistPopupRef.current.preview) {
        return;
      }
      if (items.length === 0) {
        closeAssistPopup();
        return;
      }

      const anchor = editor.getScrolledVisiblePosition(position);
      if (!anchor) {
        return;
      }

      const layout = editor.getLayoutInfo();
      const popupWidth = 312;
      const popupHeight = Math.min(260, 76 + items.length * 34);
      const left = Math.min(
        Math.max(anchor.left + 12, 8),
        Math.max(8, layout.width - popupWidth - 8),
      );
      const top =
        anchor.top + anchor.height + popupHeight <= layout.height
          ? anchor.top + anchor.height + 8
          : Math.max(8, anchor.top - popupHeight - 8);

      setAssistPopupSync({
        items,
        selectedIndex: 0,
        left,
        top,
        preview: Boolean(options?.autoOnly),
        visibleCount: Math.min(ASSIST_POPUP_INITIAL_VISIBLE, items.length),
      });
    },
    [buildAssistItems, closeAssistPopup, setAssistPopupSync],
  );

  /** 보조 팝업 선택 항목을 실행한다. */
  const executeAssistPopupItem = useCallback(
    (item: AssistPopupItem) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor) {
        return;
      }

      if (item.type === 'registerTerm') {
        closeAssistPopup();
        handleQuickRegisterTerm(item.name ?? '');
        return;
      }
      if (item.type === 'registerDomain') {
        closeAssistPopup();
        handleQuickRegisterDomain(item.name ?? '');
        return;
      }

      if (!monaco || !item.insertText) {
        return;
      }
      editor.executeEdits('dsl-assist', [
        {
          range: new monaco.Range(
            item.lineNumber,
            item.startColumn,
            item.lineNumber,
            item.endColumn,
          ),
          text: item.insertText,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
      closeAssistPopup();
    },
    [closeAssistPopup, handleQuickRegisterDomain, handleQuickRegisterTerm],
  );

  /** 다크 모드 감지 (반응형) */
  const isDark = useDarkMode();

  /** 최신 보조 팝업 상태를 ref로 유지한다. */
  useEffect(() => {
    assistPopupRef.current = assistPopup;
    assistPopupVisibleKeyRef.current?.set(Boolean(assistPopup));
  }, [assistPopup]);

  /** 선택 항목이 바뀌면 리스트를 자동 스크롤한다. */
  useEffect(() => {
    if (!assistPopup) {
      return;
    }
    const list = assistPopupListRef.current;
    if (!list) {
      return;
    }
    const selectedEl = list.querySelector<HTMLElement>(
      `[data-assist-index="${assistPopup.selectedIndex}"]`,
    );
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [assistPopup]);

  // 빠른 용어/도메인 등록 이후 사전이 갱신되면 현재 DSL을 재파싱한다.
  useEffect(() => {
    if (!pendingDictionaryReparseRef.current) {
      return;
    }
    pendingDictionaryReparseRef.current = false;

    if (!dslText.trim()) {
      return;
    }
    handleDslChange(dslText);
  }, [terms, domains, dslText, handleDslChange]);

  // diagnostics 변경 시 Monaco 에러 마커 갱신
  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    if (!parseResult || parseResult.diagnostics.length === 0) {
      monaco.editor.setModelMarkers(model, 'dsl', []);
    } else {
      const markers: Monaco.editor.IMarkerData[] = parseResult.diagnostics.map((diag) => ({
        severity:
          diag.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: t(diag.messageKey as any, diag.messageArgs),
        startLineNumber: diag.line,
        startColumn: diag.startColumn,
        endLineNumber: diag.line,
        endColumn: diag.endColumn,
      }));

      monaco.editor.setModelMarkers(model, 'dsl', markers);
    }

    return () => {
      if (!model.isDisposed()) {
        monaco.editor.setModelMarkers(model, 'dsl', []);
      }
    };
  }, [parseResult, t]);

  // Ctrl+Space는 팝업 오픈 트리거로 유지한다.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !canEdit) {
      closeAssistPopup();
      return;
    }

    const keyDownDisposable = editor.onKeyDown((event) => {
      const browserEvent = event.browserEvent;
      /**
       * 현재 키 이벤트를 Monaco/브라우저 양쪽에서 소비 처리한다.
       *
       * @returns 없음
       */
      const consume = () => {
        event.preventDefault();
        event.stopPropagation();
        browserEvent.preventDefault();
        browserEvent.stopPropagation();
        browserEvent.stopImmediatePropagation?.();
      };

      const isCtrlSpace =
        event.keyCode === monaco.KeyCode.Space && (browserEvent.ctrlKey || browserEvent.metaKey);
      if (isCtrlSpace) {
        consume();
        openAssistPopup({ autoOnly: false });
        return;
      }

      const popup = assistPopupRef.current;
      if (!popup || popup.items.length === 0) {
        return;
      }
      const visibleCount = Math.max(1, Math.min(popup.visibleCount, popup.items.length));
      if (browserEvent.isComposing) {
        return;
      }
      if (browserEvent.altKey || browserEvent.ctrlKey || browserEvent.metaKey) {
        return;
      }

      if (event.keyCode === monaco.KeyCode.DownArrow) {
        consume();
        setAssistPopupSelectedIndex((popup.selectedIndex + 1) % visibleCount);
        return;
      }

      if (event.keyCode === monaco.KeyCode.UpArrow) {
        consume();
        setAssistPopupSelectedIndex((popup.selectedIndex - 1 + visibleCount) % visibleCount);
        return;
      }

      if (
        (event.keyCode === monaco.KeyCode.Enter && !browserEvent.shiftKey) ||
        event.keyCode === monaco.KeyCode.Tab
      ) {
        consume();
        const selected = popup.items[popup.selectedIndex] ?? popup.items[0];
        if (selected) {
          executeAssistPopupItem(selected);
        }
        return;
      }

      if (event.keyCode === monaco.KeyCode.Escape) {
        consume();
        closeAssistPopup();
      }
    });

    return () => keyDownDisposable.dispose();
  }, [
    canEdit,
    closeAssistPopup,
    executeAssistPopupItem,
    openAssistPopup,
    setAssistPopupSelectedIndex,
  ]);

  // 팝업 표시 중 방향키/선택/닫기를 Monaco 키바인딩으로 선점한다.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !canEdit) {
      return;
    }

    assistPopupVisibleKeyRef.current = editor.createContextKey('dslAssistPopupVisible', false);
    assistPopupVisibleKeyRef.current.set(Boolean(assistPopupRef.current));

    /**
     * 보조 팝업 선택 인덱스를 delta만큼 순환 이동한다.
     *
     * @param delta 이동량 (양수: 아래, 음수: 위)
     * @returns 없음
     */
    const moveSelection = (delta: number) => {
      const popup = assistPopupRef.current;
      if (!popup || popup.items.length === 0) {
        return;
      }
      const visibleCount = Math.max(1, Math.min(popup.visibleCount, popup.items.length));
      const nextIndex =
        delta > 0
          ? (popup.selectedIndex + delta) % visibleCount
          : (popup.selectedIndex + delta + visibleCount) % visibleCount;
      setAssistPopupSelectedIndex(nextIndex);
    };

    /**
     * 현재 선택된 보조 팝업 항목을 실행한다.
     *
     * @returns 없음
     */
    const executeSelected = () => {
      const popup = assistPopupRef.current;
      if (!popup) {
        return;
      }
      const selected = popup.items[popup.selectedIndex] ?? popup.items[0];
      if (selected) {
        executeAssistPopupItem(selected);
      }
    };

    const disposables: Monaco.IDisposable[] = [
      editor.addAction({
        id: 'dsl-assist-popup-up',
        label: 'DSL Assist Popup Up',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.UpArrow],
        run: () => moveSelection(-1),
      }),
      editor.addAction({
        id: 'dsl-assist-popup-down',
        label: 'DSL Assist Popup Down',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.DownArrow],
        run: () => moveSelection(1),
      }),
      editor.addAction({
        id: 'dsl-assist-popup-accept-enter',
        label: 'DSL Assist Popup Accept Enter',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.Enter],
        run: () => executeSelected(),
      }),
      editor.addAction({
        id: 'dsl-assist-popup-accept-tab',
        label: 'DSL Assist Popup Accept Tab',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.Tab],
        run: () => executeSelected(),
      }),
      editor.addAction({
        id: 'dsl-assist-popup-close',
        label: 'DSL Assist Popup Close',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.Escape],
        run: () => closeAssistPopup(),
      }),
    ];

    return () => {
      disposables.forEach((disposable) => disposable.dispose());
      assistPopupVisibleKeyRef.current = null;
    };
  }, [canEdit, closeAssistPopup, executeAssistPopupItem, setAssistPopupSelectedIndex]);

  // 커서가 단어 뒤에서 멈춰 있으면 동일 보조 팝업을 자동 표시한다.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !canEdit) {
      clearIdleQuickActionTimer();
      closeAssistPopup();
      return;
    }

    /**
     * 커서 정지 후 자동 보조 팝업을 띄우기 위한 타이머를 예약한다.
     *
     * @returns 없음
     */
    const scheduleIdleQuickAction = () => {
      clearIdleQuickActionTimer();
      const pos = editor.getPosition();
      if (!pos) {
        return;
      }
      idleCursorSnapshotRef.current = { lineNumber: pos.lineNumber, column: pos.column };

      idleQuickActionTimerRef.current = setTimeout(() => {
        const currentPos = editor.getPosition();
        const snapshot = idleCursorSnapshotRef.current;
        if (!currentPos || !snapshot) {
          return;
        }
        if (
          currentPos.lineNumber !== snapshot.lineNumber ||
          currentPos.column !== snapshot.column
        ) {
          return;
        }

        openAssistPopup({ position: currentPos, autoOnly: true });
      }, QUICK_ACTION_IDLE_DELAY_MS);
    };

    const changeDisposable = editor.onDidChangeModelContent(() => {
      closeAssistPopup();
      scheduleIdleQuickAction();
    });
    const cursorDisposable = editor.onDidChangeCursorPosition(scheduleIdleQuickAction);
    const focusDisposable = editor.onDidFocusEditorText(scheduleIdleQuickAction);
    const scrollDisposable = editor.onDidScrollChange(closeAssistPopup);
    const blurDisposable = editor.onDidBlurEditorText(() => {
      clearIdleQuickActionTimer();
      closeAssistPopup();
    });

    scheduleIdleQuickAction();

    return () => {
      clearIdleQuickActionTimer();
      changeDisposable.dispose();
      cursorDisposable.dispose();
      focusDisposable.dispose();
      scrollDisposable.dispose();
      blurDisposable.dispose();
    };
  }, [canEdit, clearIdleQuickActionTimer, closeAssistPopup, openAssistPopup]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-end">
          <DslDiagnosticGuideDialog
            diagnostics={parseResult?.diagnostics ?? []}
            parsing={parsing}
            hasInput={dslText.trim().length > 0}
            onMoveToDiagnostic={handleMoveToDiagnostic}
            onQuickRegisterTerm={canEdit ? handleQuickRegisterTerm : undefined}
            onQuickRegisterDomain={canEdit ? handleQuickRegisterDomain : undefined}
          />
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          language={DSL_LANGUAGE_ID}
          value={dslText}
          onChange={handleUserCodeChange}
          beforeMount={handleBeforeMount}
          onMount={handleOnMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            tabSize: 2,
            renderLineHighlight: 'gutter',
            quickSuggestions: false,
            wordBasedSuggestions: 'off',
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnCommitCharacter: false,
          }}
          theme={isDark ? 'vs-dark' : 'vs'}
        />

        {assistPopup && (
          <div
            className="absolute z-20 pointer-events-none"
            style={{ left: assistPopup.left, top: assistPopup.top }}
          >
            <div
              className={cn(
                'pointer-events-auto w-[312px] animate-in fade-in zoom-in-95 duration-150 rounded-xl border p-2.5 shadow-lg backdrop-blur-sm transition-all',
                assistPopup.preview
                  ? 'border-border/60 bg-card/70 opacity-40 hover:opacity-100'
                  : 'border-border/80 bg-card/100 opacity-100',
              )}
              onMouseDown={promoteAssistPopup}
            >
              <div className="mb-2 flex items-center justify-between border-b border-border/70 pb-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t('erd.dsl.assist.title')}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>
                    {t('erd.dsl.assist.moreCount', {
                      shown: Math.min(assistPopup.visibleCount, assistPopup.items.length),
                      total: assistPopup.items.length,
                    })}
                  </span>
                  <span>{t('erd.dsl.assist.keyboardHint')}</span>
                </div>
              </div>
              <p className="sr-only" aria-live="polite">
                {`${assistPopup.selectedIndex + 1}/${Math.min(
                  assistPopup.visibleCount,
                  assistPopup.items.length,
                )} ${assistPopup.items[assistPopup.selectedIndex]?.label ?? ''}`}
              </p>
              <ul
                ref={assistPopupListRef}
                role="listbox"
                aria-label={t('erd.dsl.assist.title')}
                aria-activedescendant={`dsl-assist-option-${assistPopup.selectedIndex}`}
                className="max-h-[228px] space-y-1 overflow-y-auto"
              >
                {assistPopup.items.slice(0, assistPopup.visibleCount).map((item, idx) => {
                  const selected = assistPopup.selectedIndex === idx;
                  const optionId = `dsl-assist-option-${idx}`;
                  return (
                    <li key={item.id}>
                      <button
                        id={optionId}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          'flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/70',
                        )}
                        data-assist-index={idx}
                        onMouseEnter={() => setAssistPopupSelectedIndex(idx)}
                        onMouseDown={(event) => {
                          // 버튼 클릭 시 editor blur가 먼저 발생하면 popup이 닫혀 onClick이 유실될 수 있다.
                          event.preventDefault();
                        }}
                        onClick={() => executeAssistPopupItem(item)}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-1.5 text-xs font-medium leading-5">
                            {item.type !== 'insert' && (
                              <Sparkles className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.description && (
                            <span className="truncate text-[11px] text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </span>
                        {item.type !== 'insert' && (
                          <Badge
                            variant="secondary"
                            className="h-5 shrink-0 px-1.5 text-[10px] font-medium"
                          >
                            {t('erd.dsl.assist.badgeNew')}
                          </Badge>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {assistPopup.visibleCount < assistPopup.items.length && (
                <div className="mt-2 border-t border-border/60 pt-2">
                  <button
                    type="button"
                    aria-label={t('erd.dsl.assist.loadMore')}
                    className="w-full rounded-md bg-muted/60 px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={expandAssistPopupVisibleCount}
                  >
                    {t('erd.dsl.assist.loadMore')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 파싱 결과 프리뷰 + Apply/Refresh 버튼 */}
      <CodeEditorFooter
        onApply={handleApplyWithSyncReset}
        canApply={canApply}
        executeApply={executeApplyWithSyncReset}
        confirmOpen={confirmOpen}
        setConfirmOpen={setConfirmOpen}
        confirmDescription={confirmDescription}
        onRefresh={handleRefresh}
        executeRefresh={executeRefresh}
        hasNodes={hasNodes}
        refreshConfirmOpen={refreshConfirmOpen}
        setRefreshConfirmOpen={setRefreshConfirmOpen}
      >
        <div className="flex items-center gap-2 text-xs min-h-[20px] flex-wrap">
          {parsing && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('erd.ddlImport.parsing')}
            </span>
          )}

          {!parsing && parseResult && (
            <>
              {parseResult.result.tables.length > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('erd.ddlImport.preview', {
                    tables: parseResult.result.tables.length,
                    relations: parseResult.result.relations.length,
                  })}
                </span>
              )}

              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  {t('erd.dsl.errorCount', { count: errorCount })}
                </span>
              )}

              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-erd-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {t('erd.dsl.warningCount', { count: warningCount })}
                </span>
              )}

              {parseResult.result.tables.length === 0 && errorCount === 0 && dslText.trim() && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  {t('erd.dsl.noTables')}
                </span>
              )}
            </>
          )}

          {syncStatusMeta && (
            <span
              className={cn('flex items-center gap-1', syncStatusMeta.className)}
              aria-label={t('erd.sync.statusAria')}
            >
              <syncStatusMeta.Icon
                className={cn('h-3 w-3', syncStatusMeta.spin && 'animate-spin')}
              />
              {syncStatusMeta.label}
            </span>
          )}
        </div>
      </CodeEditorFooter>

      <QuickTermDialog
        open={quickTermOpen}
        onOpenChange={setQuickTermOpen}
        initialLogicalName={quickTermInitialLogicalName}
        onApply={requestDictionaryReparse}
      />

      <QuickDomainDialog
        open={quickDomainOpen}
        onOpenChange={setQuickDomainOpen}
        onCreated={requestDictionaryReparse}
        initialLogicalName={quickDomainInitialLogicalName}
      />
    </div>
  );
}
