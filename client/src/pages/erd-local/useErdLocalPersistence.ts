import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as Y from 'yjs';
import useCanvasStore from '@/stores/useCanvasStore';
import { migrateJsonToYDoc } from '@/collaboration/yjsBridge';
import {
  parseErdLocalFileText,
  readErdLocalDraft,
  writeErdLocalDraft,
} from '@/lib/erd-local-storage';
import { getErrorMessage } from '@/lib/api-error';
import { STORAGE_KEYS } from '@/constants/storage';

/** 로컬 Y.Doc bootstrap 트랜잭션 origin. */
const ERD_LOCAL_BOOTSTRAP_ORIGIN = 'erd-local-bootstrap';
/** autosave 간격 (ms). */
const ERD_LOCAL_AUTOSAVE_INTERVAL_MS = 5000;
/** 지연 projection flush debounce (ms). */
const ERD_LOCAL_FLUSH_DEBOUNCE_MS = 50;
/** 파일 다운로드용 기본 파일명. */
const ERD_LOCAL_FILE_NAME = 'erd-local.json';

/** 파일 다운로드를 트리거하는 결과. */
interface ErdLocalFileTrigger {
  /** 다운로드한 파일명 */
  filename: string;
}

/**
 * Y.Doc 변경 시 지연된 projection을 반영하도록 구독한다.
 *
 * `canvas-system-*` 트랜잭션(DDL import, 코드 동기화 등)은 projection을
 * projector에게 위임하는데, 로컬 모드에는 projector가 없으므로 여기서 flush한다.
 * 일반 로컬 편집은 defer 큐에 쌓이지 않아 no-op으로 스킵된다.
 *
 * @param doc 구독 대상 문서
 * @returns 구독 해제 함수
 */
function subscribeDeferredFlush(doc: Y.Doc): () => void {
  /** 지연 projection flush 타이머 */
  let flushTimer: number | undefined;
  /** ydoc 변경 핸들러. @returns 없음 */
  const handleDocUpdate = () => {
    if (!useCanvasStore.getState().internal.hasDeferredProjectionSync) {
      return;
    }
    window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(() => {
      useCanvasStore.getState().flushDeferredProjection();
    }, ERD_LOCAL_FLUSH_DEBOUNCE_MS);
  };
  doc.on('update', handleDocUpdate);
  return () => {
    window.clearTimeout(flushTimer);
    doc.off('update', handleDocUpdate);
  };
}

/**
 * 현재 캔버스 JSON을 파일로 다운로드한다.
 *
 * @param filename 다운로드 파일명
 * @param json     저장할 JSON 문자열
 * @returns 다운로드 결과
 */
function triggerJsonFileDownload(filename: string, json: string): ErdLocalFileTrigger {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename };
}

/**
 * ERD 로컬 모드의 Y.Doc 생명주기와 자동저장을 관리하는 훅.
 *
 * 마운트 시 로컬 Y.Doc을 생성하고 저장된 드래프트를 복원하며,
 * 5초 간격 + 탭 종료 시점에 변경분을 localStorage에 저장한다.
 *
 * @returns exportFile(파일 저장), importFileText(파일 열기), resetAll(초기화)
 */
export function useErdLocalPersistence() {
  const { t } = useTranslation();
  /** 마지막으로 저장한 직렬화 문자열 (불필요한 쓰기 방지용) */
  const lastSavedRef = useRef<string | null>(null);
  /** 현재 바인딩된 Y.Doc (교체·unmount 시 정리용) */
  const docRef = useRef<Y.Doc | null>(null);
  /** 현재 Y.Doc의 flush 구독 해제 함수 */
  const unsubscribeFlushRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;
    unsubscribeFlushRef.current = subscribeDeferredFlush(doc);
    useCanvasStore.getState().initYDoc(doc);
    const draft = readErdLocalDraft(localStorage);
    if (draft !== null) {
      migrateJsonToYDoc(doc, draft, ERD_LOCAL_BOOTSTRAP_ORIGIN);
    }
    lastSavedRef.current = useCanvasStore.getState().serialize();

    /** 변경분이 있으면 localStorage에 저장한다. @returns 없음 */
    const saveIfDirty = () => {
      const json = useCanvasStore.getState().serialize();
      if (json === lastSavedRef.current) {
        return;
      }
      const ok = writeErdLocalDraft(localStorage, json);
      if (ok) {
        lastSavedRef.current = json;
      } else {
        toast.error(t('erdLocal.storageFull'));
      }
    };

    const intervalId = window.setInterval(saveIfDirty, ERD_LOCAL_AUTOSAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', saveIfDirty);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', saveIfDirty);
      saveIfDirty();
      unsubscribeFlushRef.current?.();
      unsubscribeFlushRef.current = null;
      useCanvasStore.getState().destroyYDoc();
      docRef.current?.destroy();
      docRef.current = null;
    };
  }, [t]);

  /** 현재 캔버스를 JSON 파일로 다운로드한다. */
  const exportFile = useCallback(() => {
    const json = useCanvasStore.getState().serialize();
    triggerJsonFileDownload(ERD_LOCAL_FILE_NAME, json);
    const ok = writeErdLocalDraft(localStorage, json);
    if (ok) {
      lastSavedRef.current = json;
    }
  }, []);

  /**
   * 파일 텍스트를 검증하고 캔버스에 반영한다.
   *
   * @param text 사용자가 연 파일의 텍스트
   * @returns 반영 성공 여부
   */
  const importFileText = useCallback(
    (text: string): boolean => {
      const json = parseErdLocalFileText(text);
      if (json === null) {
        toast.error(t('erdLocal.importError'));
        return false;
      }
      try {
        const previous = docRef.current;
        const doc = new Y.Doc();
        unsubscribeFlushRef.current?.();
        useCanvasStore.getState().destroyYDoc();
        previous?.destroy();
        docRef.current = doc;
        unsubscribeFlushRef.current = subscribeDeferredFlush(doc);
        useCanvasStore.getState().initYDoc(doc);
        migrateJsonToYDoc(doc, json, ERD_LOCAL_BOOTSTRAP_ORIGIN);
        const ok = writeErdLocalDraft(localStorage, json);
        if (ok) {
          lastSavedRef.current = json;
        }
        return true;
      } catch (err) {
        toast.error(getErrorMessage(err, t('erdLocal.importError')));
        return false;
      }
    },
    [t],
  );

  /** 캔버스와 로컬 저장본을 모두 비운다. */
  const resetAll = useCallback(() => {
    const previous = docRef.current;
    const doc = new Y.Doc();
    unsubscribeFlushRef.current?.();
    useCanvasStore.getState().destroyYDoc();
    previous?.destroy();
    docRef.current = doc;
    unsubscribeFlushRef.current = subscribeDeferredFlush(doc);
    useCanvasStore.getState().initYDoc(doc);
    localStorage.removeItem(STORAGE_KEYS.ERD_LOCAL_DRAFT);
    lastSavedRef.current = useCanvasStore.getState().serialize();
  }, []);

  return { exportFile, importFileText, resetAll };
}
