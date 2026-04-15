import type {
  BaseDocumentPlugin,
  CanvasInputAdapter,
  DocumentCommand,
  InputAdapters,
  MutationPolicy,
  PluginContext,
  Projector,
  ScopeResolver,
} from '@/collaboration/core/contracts/document-plugin';
import { YJS_SHARED_DOCUMENT_ENGINE_ID } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { ScreenSpecMutationPolicy } from './screen-spec-mutation-policy';
import { ScreenSpecProjector } from './screen-spec-projector';
import { ScreenSpecScopeResolver } from './screen-spec-scope-resolver';
import {
  SCREEN_DESIGN_DOCUMENT_SCHEMA_VERSION,
  type ScreenDesignLibraryCategoryId,
  type ScreenDesignMasterTier,
} from '@/pages/screendesign/screen-design-document';

export const SCREEN_SPEC_DOCUMENT_PLUGIN_ID = 'screen-spec';
export const SCREEN_SPEC_DOCUMENT_ENGINE_ID = YJS_SHARED_DOCUMENT_ENGINE_ID;

const SCREEN_SPEC_PLUGIN_SCHEMA_VERSION = SCREEN_DESIGN_DOCUMENT_SCHEMA_VERSION;

export type ScreenSpecScreenMoveDirection = 'up' | 'down';
export type ScreenSpecLayerMoveDirection = 'forward' | 'backward' | 'front' | 'back';

export interface ScreenSpecCanvasInputAdapter extends CanvasInputAdapter {
  addScreen: (screenId: string, name: string, width: number, height: number) => DocumentCommand;
  renameScreen: (screenId: string, name: string) => DocumentCommand;
  updateScreenFrame: (screenId: string, width: number, height: number) => DocumentCommand;
  moveScreen: (screenId: string, direction: ScreenSpecScreenMoveDirection) => DocumentCommand;
  deleteScreen: (screenId: string) => DocumentCommand;
  addMaster: (
    masterId: string,
    name: string,
    categoryId: ScreenDesignLibraryCategoryId,
    tier: ScreenDesignMasterTier,
  ) => DocumentCommand;
  updateMaster: (
    masterId: string,
    updates: Partial<{
      name: string;
      categoryId: ScreenDesignLibraryCategoryId;
      tier: ScreenDesignMasterTier;
      width: number;
      height: number;
      accentColor: string | null;
    }>,
  ) => DocumentCommand;
  deleteMaster: (masterId: string) => DocumentCommand;
  addInstance: (
    instanceId: string,
    screenId: string,
    masterId: string,
    x: number,
    y: number,
  ) => DocumentCommand;
  updateInstance: (
    instanceId: string,
    screenId: string,
    updates: Partial<{
      x: number;
      y: number;
      width: number | null;
      height: number | null;
      label: string | null;
      accentColor: string | null;
      masterId: string;
    }>,
  ) => DocumentCommand;
  deleteInstance: (instanceId: string, screenId: string) => DocumentCommand;
  moveInstanceLayer: (
    screenId: string,
    instanceId: string,
    direction: ScreenSpecLayerMoveDirection,
  ) => DocumentCommand;
}

class ScreenSpecCanvasInputAdapterImpl implements ScreenSpecCanvasInputAdapter {
  readonly kind = 'canvas' as const;

  /**
   * screen 추가 command를 생성한다.
   *
   * @param screenId 생성할 screen id
   * @param name screen 이름
   * @param width screen 너비
   * @param height screen 높이
   * @returns screen 추가 command
   */
  addScreen(screenId: string, name: string, width: number, height: number): DocumentCommand {
    return {
      key: 'screen:add',
      payload: {
        screenId,
        name,
        width,
        height,
      },
    };
  }

  /**
   * screen 이름 변경 command를 생성한다.
   *
   * @param screenId 대상 screen id
   * @param name 새 screen 이름
   * @returns screen 이름 변경 command
   */
  renameScreen(screenId: string, name: string): DocumentCommand {
    return {
      key: 'screen:rename',
      payload: {
        screenId,
        name,
      },
    };
  }

  /**
   * screen 프레임 변경 command를 생성한다.
   *
   * @param screenId 대상 screen id
   * @param width 새 너비
   * @param height 새 높이
   * @returns screen 프레임 변경 command
   */
  updateScreenFrame(screenId: string, width: number, height: number): DocumentCommand {
    return {
      key: 'screen:update-frame',
      payload: {
        screenId,
        width,
        height,
      },
    };
  }

  /**
   * screen 순서 이동 command를 생성한다.
   *
   * @param screenId 이동할 screen id
   * @param direction 이동 방향
   * @returns screen 이동 command
   */
  moveScreen(screenId: string, direction: ScreenSpecScreenMoveDirection): DocumentCommand {
    return {
      key: 'screen:move',
      payload: {
        screenId,
        direction,
      },
    };
  }

  /**
   * screen 삭제 command를 생성한다.
   *
   * @param screenId 삭제할 screen id
   * @returns screen 삭제 command
   */
  deleteScreen(screenId: string): DocumentCommand {
    return {
      key: 'screen:delete',
      payload: {
        screenId,
      },
    };
  }

  /**
   * master 추가 command를 생성한다.
   *
   * @param masterId 생성할 master id
   * @param name master 이름
   * @param categoryId master 카테고리
   * @param tier master tier
   * @returns master 추가 command
   */
  addMaster(
    masterId: string,
    name: string,
    categoryId: ScreenDesignLibraryCategoryId,
    tier: ScreenDesignMasterTier,
  ): DocumentCommand {
    return {
      key: 'master:add',
      payload: {
        masterId,
        name,
        categoryId,
        tier,
      },
    };
  }

  /**
   * master 수정 command를 생성한다.
   *
   * @param masterId 수정할 master id
   * @param updates 수정할 master 필드
   * @returns master 수정 command
   */
  updateMaster(
    masterId: string,
    updates: Partial<{
      name: string;
      categoryId: ScreenDesignLibraryCategoryId;
      tier: ScreenDesignMasterTier;
      width: number;
      height: number;
      accentColor: string | null;
    }>,
  ): DocumentCommand {
    return {
      key: 'master:update',
      payload: {
        masterId,
        ...updates,
      },
    };
  }

  /**
   * master 삭제 command를 생성한다.
   *
   * @param masterId 삭제할 master id
   * @returns master 삭제 command
   */
  deleteMaster(masterId: string): DocumentCommand {
    return {
      key: 'master:delete',
      payload: {
        masterId,
      },
    };
  }

  /**
   * instance 추가 command를 생성한다.
   *
   * @param instanceId 생성할 instance id
   * @param screenId 배치 대상 screen id
   * @param masterId 기반 master id
   * @param x instance x 좌표
   * @param y instance y 좌표
   * @returns instance 추가 command
   */
  addInstance(
    instanceId: string,
    screenId: string,
    masterId: string,
    x: number,
    y: number,
  ): DocumentCommand {
    return {
      key: 'instance:add',
      payload: {
        instanceId,
        screenId,
        masterId,
        x,
        y,
      },
    };
  }

  /**
   * instance 수정 command를 생성한다.
   *
   * @param instanceId 수정할 instance id
   * @param screenId instance가 속한 screen id
   * @param updates 수정할 instance 필드
   * @returns instance 수정 command
   */
  updateInstance(
    instanceId: string,
    screenId: string,
    updates: Partial<{
      x: number;
      y: number;
      width: number | null;
      height: number | null;
      label: string | null;
      accentColor: string | null;
      masterId: string;
    }>,
  ): DocumentCommand {
    return {
      key: 'instance:update',
      payload: {
        instanceId,
        screenId,
        ...updates,
      },
    };
  }

  /**
   * instance 삭제 command를 생성한다.
   *
   * @param instanceId 삭제할 instance id
   * @param screenId instance가 속한 screen id
   * @returns instance 삭제 command
   */
  deleteInstance(instanceId: string, screenId: string): DocumentCommand {
    return {
      key: 'instance:delete',
      payload: {
        instanceId,
        screenId,
      },
    };
  }

  /**
   * layer 순서 이동 command를 생성한다.
   *
   * @param screenId 대상 screen id
   * @param instanceId 이동할 instance id
   * @param direction layer 이동 방향
   * @returns layer 이동 command
   */
  moveInstanceLayer(
    screenId: string,
    instanceId: string,
    direction: ScreenSpecLayerMoveDirection,
  ): DocumentCommand {
    return {
      key: 'layer:move',
      payload: {
        screenId,
        instanceId,
        direction,
      },
    };
  }
}

/**
 * 화면기획 캔버스 adapter 여부를 판별한다.
 *
 * @param value 검사 대상 adapter
 * @returns 화면기획 캔버스 adapter면 true
 */
export function isScreenSpecCanvasInputAdapter(
  value: CanvasInputAdapter | undefined,
): value is ScreenSpecCanvasInputAdapter {
  return (
    value?.kind === 'canvas' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).addScreen === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).renameScreen === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).updateScreenFrame === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).moveScreen === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).deleteScreen === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).addMaster === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).updateMaster === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).deleteMaster === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).addInstance === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).updateInstance === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).deleteInstance === 'function' &&
    typeof (value as Partial<ScreenSpecCanvasInputAdapter>).moveInstanceLayer === 'function'
  );
}

/**
 * 화면기획 캔버스 command adapter를 생성한다.
 *
 * @returns 화면기획 캔버스 command adapter
 */
export function createScreenSpecCanvasInputAdapter(): ScreenSpecCanvasInputAdapter {
  return new ScreenSpecCanvasInputAdapterImpl();
}

/**
 * 화면기획 문서 플러그인 골격.
 */
export class ScreenSpecDocumentPlugin implements BaseDocumentPlugin {
  readonly pluginId = SCREEN_SPEC_DOCUMENT_PLUGIN_ID;
  readonly schemaVersion = SCREEN_SPEC_PLUGIN_SCHEMA_VERSION;
  readonly supportedEngineIds = [SCREEN_SPEC_DOCUMENT_ENGINE_ID];

  /**
   * 화면기획 문서용 input adapter 묶음을 생성한다.
   *
   * @param context 문서 플러그인 context
   * @returns 화면기획 입력 어댑터 묶음
   */
  createInputAdapters(context: PluginContext): InputAdapters {
    void context;
    return {
      canvas: createScreenSpecCanvasInputAdapter(),
      form: {
        kind: 'form',
      },
    };
  }

  /**
   * 화면기획 문서용 mutation policy를 생성한다.
   *
   * @param context 문서 플러그인 context
   * @returns 화면기획 mutation policy
   */
  createMutationPolicy(context: PluginContext): MutationPolicy {
    return new ScreenSpecMutationPolicy(this.createScopeResolver(context));
  }

  /**
   * 화면기획 문서용 projector 목록을 생성한다.
   *
   * @param context 문서 플러그인 context
   * @returns 화면기획 projector 목록
   */
  createProjectors(context: PluginContext): Projector[] {
    return [new ScreenSpecProjector(context.projectionBridge)];
  }

  /**
   * 화면기획 문서용 scope resolver를 생성한다.
   *
   * @param context 문서 플러그인 context
   * @returns 화면기획 scope resolver
   */
  createScopeResolver(context: PluginContext): ScopeResolver {
    void context;
    return new ScreenSpecScopeResolver();
  }
}

/**
 * 화면기획 문서 플러그인 인스턴스를 생성한다.
 *
 * @returns 화면기획 문서 플러그인 인스턴스
 */
export function createScreenSpecDocumentPlugin(): ScreenSpecDocumentPlugin {
  return new ScreenSpecDocumentPlugin();
}
