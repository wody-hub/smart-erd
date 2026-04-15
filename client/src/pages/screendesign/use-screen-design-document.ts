import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentCommand } from '@/collaboration/core/contracts/document-plugin';
import type { DocumentMutationSession } from '@/collaboration/core/session/document-mutation-session';
import type { DocumentCommandDispatchResult } from '@/collaboration/core/session/document-mutation-session';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import {
  createScreenSpecCanvasInputAdapter,
  isScreenSpecCanvasInputAdapter,
  type ScreenSpecLayerMoveDirection,
} from '@/collaboration/plugins/screen-spec/screen-spec-document-plugin';
import { ScreenSpecDocumentMutationApplier } from '@/collaboration/plugins/screen-spec/screen-spec-document-mutation-applier';
import { ScreenSpecMutationPolicy } from '@/collaboration/plugins/screen-spec/screen-spec-mutation-policy';
import { ScreenSpecScopeResolver } from '@/collaboration/plugins/screen-spec/screen-spec-scope-resolver';
import { sanitizeMasterDimension } from '@/collaboration/plugins/screen-spec/screen-spec-yjs-helpers';
import {
  resolveScreenDesignFramePreset,
  type ScreenDesignFramePresetId,
} from './screen-design-frame-presets';
import {
  EMPTY_SCREEN_DESIGN_DOCUMENT,
  ensureScreenDesignDocumentStructure,
  readScreenDesignDocument,
  resolveLibraryItemById,
  type ScreenDesignLibraryCategoryId,
  type ScreenDesignDocumentSnapshot,
  type ScreenDesignScreen,
  type ScreenDesignMasterTier,
} from './screen-design-document';

export interface AddInstanceParams {
  screenId: string;
  masterId: string;
  x: number;
  y: number;
}

export interface UpdateInstanceParams {
  x?: number;
  y?: number;
  width?: number | null;
  height?: number | null;
  label?: string | null;
  accentColor?: string | null;
  masterId?: string;
}

interface AddMasterParams {
  name: string;
  categoryId?: ScreenDesignLibraryCategoryId;
  tier?: ScreenDesignMasterTier;
}

interface UpdateMasterParams {
  name?: string;
  categoryId?: ScreenDesignLibraryCategoryId;
  tier?: ScreenDesignMasterTier;
  width?: number;
  height?: number;
  accentColor?: string | null;
}

export interface UseScreenDesignDocumentResult {
  document: ScreenDesignDocumentSnapshot;
  selectedScreenId: string | null;
  selectedScreen: ScreenDesignScreen | null;
  setSelectedScreenId: (screenId: string | null) => void;
  addScreen: (
    name: string,
    presetId?: ScreenDesignFramePresetId,
    screenId?: string,
  ) => string | null;
  renameScreen: (screenId: string, name: string) => void;
  updateScreenPreset: (screenId: string, presetId: ScreenDesignFramePresetId) => void;
  moveScreen: (screenId: string, direction: 'up' | 'down') => void;
  deleteScreen: (screenId: string) => void;
  addMaster: (params: AddMasterParams) => string | null;
  updateMaster: (masterId: string, updates: UpdateMasterParams) => void;
  deleteMaster: (masterId: string) => void;
  addInstance: (params: AddInstanceParams) => string | null;
  updateInstance: (instanceId: string, updates: UpdateInstanceParams) => void;
  deleteInstance: (instanceId: string) => void;
  moveInstanceLayer: (
    screenId: string,
    instanceId: string,
    direction: 'forward' | 'backward' | 'front' | 'back',
  ) => void;
}

interface UseScreenDesignDocumentParams {
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  documentMutationSession: DocumentMutationSession | null;
  projectionVersion: number;
}

/**
 * 화면기획 문서의 Y.Doc 스냅샷과 로컬 편집 액션을 묶어 제공한다.
 *
 * @param params 화면기획 문서 편집 파라미터
 * @returns 화면기획 문서 스냅샷과 편집 액션
 */
export function useScreenDesignDocument(
  params: UseScreenDesignDocumentParams,
): UseScreenDesignDocumentResult {
  const { sharedDocumentEngine, documentMutationSession, projectionVersion } = params;
  const [document, setDocument] = useState<ScreenDesignDocumentSnapshot>(
    EMPTY_SCREEN_DESIGN_DOCUMENT,
  );
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const canvasInputAdapter = useMemo(
    () =>
      isScreenSpecCanvasInputAdapter(documentMutationSession?.inputAdapters?.canvas)
        ? documentMutationSession.inputAdapters.canvas
        : null,
    [documentMutationSession],
  );
  const fallbackCanvasInputAdapter = useMemo(() => createScreenSpecCanvasInputAdapter(), []);
  const fallbackMutationPolicy = useMemo(
    () => new ScreenSpecMutationPolicy(new ScreenSpecScopeResolver()),
    [],
  );
  const fallbackMutationApplier = useMemo(
    () =>
      sharedDocumentEngine ? new ScreenSpecDocumentMutationApplier(sharedDocumentEngine) : null,
    [sharedDocumentEngine],
  );
  const commandAdapter = canvasInputAdapter ?? fallbackCanvasInputAdapter;
  const syncSnapshot = useCallback(() => {
    if (!sharedDocumentEngine) {
      setDocument(EMPTY_SCREEN_DESIGN_DOCUMENT);
      setSelectedScreenId(null);
      return;
    }

    const doc = sharedDocumentEngine.getDocument();
    ensureScreenDesignDocumentStructure(doc);
    setDocument(readScreenDesignDocument(doc));
  }, [sharedDocumentEngine]);

  useEffect(() => {
    syncSnapshot();
  }, [projectionVersion, syncSnapshot]);

  useEffect(() => {
    if (document.screens.length === 0) {
      if (selectedScreenId !== null) {
        setSelectedScreenId(null);
      }
      return;
    }
    if (!selectedScreenId || !document.screens.some((screen) => screen.id === selectedScreenId)) {
      setSelectedScreenId(document.screens[0]?.id ?? null);
    }
  }, [document.screens, selectedScreenId]);

  const selectedScreen = useMemo(
    () => document.screens.find((screen) => screen.id === selectedScreenId) ?? null,
    [document.screens, selectedScreenId],
  );
  const resolveInstanceScreenId = useCallback(
    (instanceId: string) => findScreenIdForInstance(document, instanceId),
    [document],
  );
  const applyFallbackCommandWithResult = useCallback(
    <T>(command: DocumentCommand): DocumentCommandDispatchResult<T> => {
      if (!fallbackMutationApplier) {
        return {
          status: 'unavailable',
        };
      }

      const result = fallbackMutationApplier.apply<T>(
        fallbackMutationPolicy.toMutation(command, {
          origin: {
            source: 'local',
          },
        }),
      );
      if (!result.applied) {
        return {
          status: 'rejected',
        };
      }

      syncSnapshot();
      return {
        status: 'applied',
        value: result.value,
      };
    },
    [fallbackMutationApplier, fallbackMutationPolicy, syncSnapshot],
  );
  const dispatchCommandWithResult = useCallback(
    <T>(command: DocumentCommand): DocumentCommandDispatchResult<T> => {
      if (documentMutationSession) {
        const result = documentMutationSession.emitCommandWithResult<T>(command);
        if (result.status === 'applied') {
          syncSnapshot();
        }
        return result;
      }
      return applyFallbackCommandWithResult<T>(command);
    },
    [applyFallbackCommandWithResult, documentMutationSession, syncSnapshot],
  );
  const dispatchCommand = useCallback(
    (command: DocumentCommand) => dispatchCommandWithResult(command).status,
    [dispatchCommandWithResult],
  );

  const addScreen = useCallback(
    (
      name: string,
      presetId: ScreenDesignFramePresetId = 'desktop',
      screenId = `screen-${crypto.randomUUID()}`,
    ) => {
      const preset = resolveScreenDesignFramePreset(presetId);
      const screenName = name.trim() || screenId;
      const result = dispatchCommandWithResult<string>(
        commandAdapter.addScreen(screenId, screenName, preset.width, preset.height),
      );
      return result.status === 'applied' ? screenId : null;
    },
    [commandAdapter, dispatchCommandWithResult],
  );

  const renameScreen = useCallback(
    (screenId: string, name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return;
      }
      void dispatchCommand(commandAdapter.renameScreen(screenId, trimmedName));
    },
    [commandAdapter, dispatchCommand],
  );

  const updateScreenPreset = useCallback(
    (screenId: string, presetId: ScreenDesignFramePresetId) => {
      const preset = resolveScreenDesignFramePreset(presetId);
      void dispatchCommand(commandAdapter.updateScreenFrame(screenId, preset.width, preset.height));
    },
    [commandAdapter, dispatchCommand],
  );

  const moveScreen = useCallback(
    (screenId: string, direction: 'up' | 'down') => {
      void dispatchCommand(commandAdapter.moveScreen(screenId, direction));
    },
    [commandAdapter, dispatchCommand],
  );

  const deleteScreen = useCallback(
    (screenId: string) => {
      void dispatchCommand(commandAdapter.deleteScreen(screenId));
    },
    [commandAdapter, dispatchCommand],
  );

  const addMaster = useCallback(
    ({ name, categoryId = 'form', tier = 'widget' }: AddMasterParams) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return null;
      }

      const masterId = `master-${crypto.randomUUID()}`;
      const result = dispatchCommandWithResult<string>(
        commandAdapter.addMaster(masterId, trimmedName, categoryId, tier),
      );
      return result.status === 'applied' ? masterId : null;
    },
    [commandAdapter, dispatchCommandWithResult],
  );

  const updateMaster = useCallback(
    (masterId: string, updates: UpdateMasterParams) => {
      const normalizedUpdates = {
        ...updates,
        ...(typeof updates.width === 'number' && Number.isFinite(updates.width)
          ? { width: sanitizeMasterDimension(updates.width) }
          : {}),
        ...(typeof updates.height === 'number' && Number.isFinite(updates.height)
          ? { height: sanitizeMasterDimension(updates.height) }
          : {}),
      };
      void dispatchCommand(commandAdapter.updateMaster(masterId, normalizedUpdates));
    },
    [commandAdapter, dispatchCommand],
  );

  const deleteMaster = useCallback(
    (masterId: string) => {
      void dispatchCommand(commandAdapter.deleteMaster(masterId));
    },
    [commandAdapter, dispatchCommand],
  );

  const addInstance = useCallback(
    ({ screenId, masterId, x, y }: AddInstanceParams) => {
      const libraryItem = resolveLibraryItemById(document.libraryItems, masterId);
      if (!libraryItem) {
        return null;
      }

      const instanceId = `instance-${crypto.randomUUID()}`;
      const result = dispatchCommandWithResult<string>(
        commandAdapter.addInstance(instanceId, screenId, masterId, x, y),
      );
      return result.status === 'applied' ? instanceId : null;
    },
    [commandAdapter, dispatchCommandWithResult, document.libraryItems],
  );

  const updateInstance = useCallback(
    (instanceId: string, updates: UpdateInstanceParams) => {
      const screenId = resolveInstanceScreenId(instanceId);
      if (!screenId) {
        return;
      }
      void dispatchCommand(commandAdapter.updateInstance(instanceId, screenId, updates));
    },
    [commandAdapter, dispatchCommand, resolveInstanceScreenId],
  );

  const deleteInstance = useCallback(
    (instanceId: string) => {
      const screenId = resolveInstanceScreenId(instanceId);
      if (!screenId) {
        return;
      }
      void dispatchCommand(commandAdapter.deleteInstance(instanceId, screenId));
    },
    [commandAdapter, dispatchCommand, resolveInstanceScreenId],
  );

  const moveInstanceLayer = useCallback(
    (
      screenId: string,
      instanceId: string,
      direction: 'forward' | 'backward' | 'front' | 'back',
    ) => {
      void dispatchCommand(
        commandAdapter.moveInstanceLayer(
          screenId,
          instanceId,
          direction as ScreenSpecLayerMoveDirection,
        ),
      );
    },
    [commandAdapter, dispatchCommand],
  );

  return {
    document,
    selectedScreenId,
    selectedScreen,
    setSelectedScreenId,
    addScreen,
    renameScreen,
    updateScreenPreset,
    moveScreen,
    deleteScreen,
    addMaster,
    updateMaster,
    deleteMaster,
    addInstance,
    updateInstance,
    deleteInstance,
    moveInstanceLayer,
  };
}

/**
 * instance id가 속한 screen id를 찾는다.
 *
 * @param document 현재 화면기획 문서 스냅샷
 * @param instanceId 찾을 instance id
 * @returns instance가 속한 screen id 또는 null
 */
function findScreenIdForInstance(
  document: ScreenDesignDocumentSnapshot,
  instanceId: string,
): string | null {
  for (const [screenId, instances] of Object.entries(document.instancesByScreenId)) {
    if (instances.some((instance) => instance.id === instanceId)) {
      return screenId;
    }
  }
  return null;
}
