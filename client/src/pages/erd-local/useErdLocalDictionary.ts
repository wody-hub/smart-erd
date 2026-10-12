import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  readErdLocalDictionary,
  writeErdLocalDictionary,
  nextErdLocalId,
  ERD_LOCAL_DICTIONARY_FILE_VERSION,
} from '@/lib/erd-local-dictionary-storage';
import type { ErdLocalDictionaryFile } from '@/lib/erd-local-dictionary-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import type {
  Domain,
  DomainFormData,
  ErdDictionaryLocalWriter,
  SuggestResponse,
  Term,
  TermFormData,
  Word,
  WordFormData,
} from '@/types/dictionary';

export interface ErdLocalDictionaryMutations {
  /** 로컬 용어 생성 (중복 논리명이면 null). */
  createTerm: (data: TermFormData) => Term | null;
  /** 로컬 도메인 생성 (중복 논리명이면 null). */
  createDomain: (data: DomainFormData) => Domain | null;
  /** 로컬 단어 생성 (중복 논리명이면 null). */
  createWord: (data: WordFormData) => Word | null;
  /** 로컬 용어 수정 (없거나 중복이면 null). */
  updateTerm: (id: number, data: TermFormData) => Term | null;
  /** 로컬 도메인 수정 (없거나 중복이면 null). */
  updateDomain: (id: number, data: DomainFormData) => Domain | null;
  /** 로컬 단어 수정 (없거나 중복이면 null). */
  updateWord: (id: number, data: WordFormData) => Word | null;
  /** 용어 삭제. */
  deleteTerm: (id: number) => void;
  /** 도메인 삭제. @returns 연결 해제된 용어 수 */
  deleteDomain: (id: number) => number;
  /** 단어 삭제. */
  deleteWord: (id: number) => void;
  /** 전체 교체 (파일 열기용). */
  replaceAll: (data: ErdLocalDictionaryFile) => void;
  /** 전체 초기화. */
  resetAll: () => void;
}

export interface ErdLocalDictionaryStore extends ErdLocalDictionaryMutations {
  /** 용어 목록 */
  terms: Term[];
  /** 도메인 목록 */
  domains: Domain[];
  /** 단어 목록 */
  words: Word[];
  /** 변경 revision (문자열) */
  revision: string;
  /** Quick 다이얼로그용 로컬 writer (생성 성공 보장형 — 중복이면 기존 항목 반환). */
  writer: ErdDictionaryLocalWriter;
}

/** 빈 사전 페이로드. */
const EMPTY_DICTIONARY: ErdLocalDictionaryFile = {
  version: ERD_LOCAL_DICTIONARY_FILE_VERSION,
  domains: [],
  terms: [],
  words: [],
};

/** 로컬 엔티티 공통 필드 (서버 전송 없음 선언). */
function localBaseFields() {
  const now = new Date().toISOString();
  return { teamId: 0, dictionarySetId: null, createdAt: now, updatedAt: now };
}

/**
 * DomainFormData에서 표시용 물리 타입을 구한다.
 *
 * 명시적 physicalType이 있으면 그것을 쓰고, 없으면 dataType/length/scale로 조립한다.
 *
 * @param form 도메인 폼 데이터
 * @returns 표시용 물리 타입
 */
function resolvePhysicalType(form: DomainFormData): string {
  const explicit = form.physicalType?.trim();
  if (explicit) {
    return explicit;
  }
  const dataType = form.dataType?.trim().toUpperCase() ?? '';
  if (!dataType) {
    return '';
  }
  if (form.dataLength == null) {
    return dataType;
  }
  if (form.dataScale == null) {
    return `${dataType}(${form.dataLength})`;
  }
  return `${dataType}(${form.dataLength},${form.dataScale})`;
}

/**
 * ERD 로컬 모드용 사전 저장소 훅.
 *
 * localStorage-backed 단일 페이로드를 useState로 들고, 매 변경을 영속화한다.
 * id는 서버 양수 id와 충돌하지 않는 음수(`nextErdLocalId`)를 발급한다.
 *
 * @returns 로컬 사전 스토어 (목록 + revision + CRUD + Quick용 writer)
 */
export function useErdLocalDictionary(): ErdLocalDictionaryStore {
  const [data, setData] = useState<ErdLocalDictionaryFile>(
    () => readErdLocalDictionary(localStorage) ?? EMPTY_DICTIONARY,
  );
  const [revision, setRevision] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    const ok = writeErdLocalDictionary(localStorage, data);
    if (!ok) {
      toast.error(t('erdLocal.storageFull'));
    }
  }, [data, t]);

  /** 동기 읽기용 미러 (setState 비동기성 회피). */
  const dataRef = useRef(data);

  /**
   * 페이로드를 교체하고 미러·revision을 동기화한다.
   *
   * @param next 다음 페이로드
   */
  const commit = useCallback((next: ErdLocalDictionaryFile) => {
    dataRef.current = next;
    setData(next);
    setRevision((prev) => prev + 1);
  }, []);

  const createTerm = useCallback(
    (form: TermFormData): Term | null => {
      const prev = dataRef.current;
      const logicalName = form.logicalName.trim();
      if (prev.terms.some((term) => term.logicalName === logicalName)) {
        return null;
      }
      const domain =
        form.domainId != null ? prev.domains.find((d) => d.id === form.domainId) : undefined;
      const term: Term = {
        id: nextErdLocalId(prev.terms.map((t) => t.id)),
        logicalName,
        physicalName: form.physicalName.trim(),
        description: form.description?.trim() || null,
        domainId: domain ? domain.id : null,
        domainLogicalName: domain ? domain.logicalName : null,
        ...localBaseFields(),
      };
      commit({ ...prev, terms: [...prev.terms, term] });
      return term;
    },
    [commit],
  );

  const createDomain = useCallback(
    (form: DomainFormData): Domain | null => {
      const prev = dataRef.current;
      const logicalName = form.logicalName.trim();
      if (prev.domains.some((domain) => domain.logicalName === logicalName)) {
        return null;
      }
      const domain: Domain = {
        id: nextErdLocalId(prev.domains.map((d) => d.id)),
        logicalName,
        domainGroup: form.domainGroup?.trim() || null,
        domainClassification: form.domainClassification?.trim() || null,
        dataType: form.dataType?.trim() ? form.dataType.trim().toUpperCase() : null,
        dataLength: form.dataLength ?? null,
        dataScale: form.dataScale ?? null,
        physicalType: resolvePhysicalType(form),
        description: form.description?.trim() || null,
        ...localBaseFields(),
      };
      commit({ ...prev, domains: [...prev.domains, domain] });
      return domain;
    },
    [commit],
  );

  const createWord = useCallback(
    (form: WordFormData): Word | null => {
      const prev = dataRef.current;
      const logicalName = form.logicalName.trim();
      if (prev.words.some((word) => word.logicalName === logicalName)) {
        return null;
      }
      const word: Word = {
        id: nextErdLocalId(prev.words.map((w) => w.id)),
        logicalName,
        physicalName: form.physicalName.trim(),
        description: form.description?.trim() || null,
        ...localBaseFields(),
      };
      commit({ ...prev, words: [...prev.words, word] });
      return word;
    },
    [commit],
  );

  const updateTerm = useCallback(
    (id: number, form: TermFormData): Term | null => {
      const prev = dataRef.current;
      const existing = prev.terms.find((term) => term.id === id);
      if (!existing) {
        return null;
      }
      const logicalName = form.logicalName.trim();
      if (prev.terms.some((term) => term.id !== id && term.logicalName === logicalName)) {
        return null;
      }
      const domain =
        form.domainId != null ? prev.domains.find((d) => d.id === form.domainId) : undefined;
      const updated: Term = {
        ...existing,
        logicalName,
        physicalName: form.physicalName.trim(),
        description: form.description?.trim() || null,
        domainId: domain ? domain.id : null,
        domainLogicalName: domain ? domain.logicalName : null,
        updatedAt: new Date().toISOString(),
      };
      commit({ ...prev, terms: prev.terms.map((term) => (term.id === id ? updated : term)) });
      return updated;
    },
    [commit],
  );

  const updateDomain = useCallback(
    (id: number, form: DomainFormData): Domain | null => {
      const prev = dataRef.current;
      const existing = prev.domains.find((domain) => domain.id === id);
      if (!existing) {
        return null;
      }
      const logicalName = form.logicalName.trim();
      if (prev.domains.some((domain) => domain.id !== id && domain.logicalName === logicalName)) {
        return null;
      }
      const updated: Domain = {
        ...existing,
        logicalName,
        domainGroup: form.domainGroup?.trim() || null,
        domainClassification: form.domainClassification?.trim() || null,
        dataType: form.dataType?.trim() ? form.dataType.trim().toUpperCase() : null,
        dataLength: form.dataLength ?? null,
        dataScale: form.dataScale ?? null,
        physicalType: resolvePhysicalType(form),
        description: form.description?.trim() || null,
        updatedAt: new Date().toISOString(),
      };
      const terms = prev.terms.map((term) =>
        term.domainId === id ? { ...term, domainLogicalName: updated.logicalName } : term,
      );
      commit({
        ...prev,
        domains: prev.domains.map((domain) => (domain.id === id ? updated : domain)),
        terms,
      });
      return updated;
    },
    [commit],
  );

  const updateWord = useCallback(
    (id: number, form: WordFormData): Word | null => {
      const prev = dataRef.current;
      const existing = prev.words.find((word) => word.id === id);
      if (!existing) {
        return null;
      }
      const logicalName = form.logicalName.trim();
      if (prev.words.some((word) => word.id !== id && word.logicalName === logicalName)) {
        return null;
      }
      const updated: Word = {
        ...existing,
        logicalName,
        physicalName: form.physicalName.trim(),
        description: form.description?.trim() || null,
        updatedAt: new Date().toISOString(),
      };
      commit({ ...prev, words: prev.words.map((word) => (word.id === id ? updated : word)) });
      return updated;
    },
    [commit],
  );

  const deleteTerm = useCallback(
    (id: number): void => {
      const prev = dataRef.current;
      commit({ ...prev, terms: prev.terms.filter((term) => term.id !== id) });
    },
    [commit],
  );

  const deleteDomain = useCallback(
    (id: number): number => {
      const prev = dataRef.current;
      let unlinked = 0;
      const terms = prev.terms.map((term) => {
        if (term.domainId !== id) {
          return term;
        }
        unlinked += 1;
        return { ...term, domainId: null, domainLogicalName: null };
      });
      commit({ ...prev, domains: prev.domains.filter((d) => d.id !== id), terms });
      return unlinked;
    },
    [commit],
  );

  const deleteWord = useCallback(
    (id: number): void => {
      const prev = dataRef.current;
      commit({ ...prev, words: prev.words.filter((word) => word.id !== id) });
    },
    [commit],
  );

  const replaceAll = useCallback(
    (next: ErdLocalDictionaryFile): void => {
      commit(next);
    },
    [commit],
  );

  const resetAll = useCallback((): void => {
    localStorage.removeItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY);
    commit(EMPTY_DICTIONARY);
  }, [commit]);

  const suggest = useCallback((keyword: string): SuggestResponse | null => {
    const { terms, domains } = dataRef.current;
    const term = terms.find((t) => t.logicalName === keyword.trim());
    if (!term) {
      return null;
    }
    const domain = term.domainId != null ? domains.find((d) => d.id === term.domainId) : undefined;
    return {
      physicalName: term.physicalName,
      domainId: term.domainId,
      domainLogicalName: domain ? domain.logicalName : term.domainLogicalName,
      matches: [
        { keyword: keyword.trim(), matched: true, physicalName: term.physicalName, source: null },
      ],
    };
  }, []);

  const writer = useMemo<ErdDictionaryLocalWriter>(
    () => ({
      createTerm: (form) =>
        dataRef.current.terms.find((t) => t.logicalName === form.logicalName.trim()) ??
        (createTerm(form) as Term),
      createDomain: (form) =>
        dataRef.current.domains.find((d) => d.logicalName === form.logicalName.trim()) ??
        (createDomain(form) as Domain),
      createWord: (form) =>
        dataRef.current.words.find((w) => w.logicalName === form.logicalName.trim()) ??
        (createWord(form) as Word),
      suggest,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision은 ref-mirror 읽기라 dep으로 불필요하지만 writer identity 안정(구독자 리렌더 트리거) 목적으로 의도적으로 포함
    [createTerm, createDomain, createWord, suggest, revision],
  );

  return {
    terms: data.terms,
    domains: data.domains,
    words: data.words,
    revision: String(revision),
    createTerm,
    createDomain,
    createWord,
    updateTerm,
    updateDomain,
    updateWord,
    deleteTerm,
    deleteDomain,
    deleteWord,
    replaceAll,
    resetAll,
    writer,
  };
}
