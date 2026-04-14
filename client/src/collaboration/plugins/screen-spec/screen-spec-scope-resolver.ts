import type { DocumentCommand } from '@/collaboration/core/contracts/document-plugin';
import type { ScopeRef } from '@/collaboration/core/contracts/document-read-executor';
import type { ScopeResolver } from '@/collaboration/core/contracts/document-plugin';
import { readString } from '@/lib/yjs-read-utils';

const MASTERS_SCOPE: ScopeRef = {
  kind: 'masters',
  id: 'collection',
  mode: 'shared',
};

const INSTANCE_CASCADE_SCOPE: ScopeRef = {
  kind: 'instance-cascade',
  id: 'collection',
  mode: 'exclusive',
};

/**
 * 화면기획 command가 영향을 주는 문서 scope를 계산한다.
 */
export class ScreenSpecScopeResolver implements ScopeResolver {
  /**
   * command payload를 screen-spec 문서 scope 목록으로 해석한다.
   *
   * @param command 해석할 문서 command
   * @returns lock/runtime 갱신에 사용할 affected scope 목록
   */
  resolve(command: DocumentCommand): ScopeRef[] {
    const masterId = readString(command.payload?.masterId);
    const screenId = readString(command.payload?.screenId);
    const instanceId = readString(command.payload?.instanceId);

    if (command.key === 'master:add') {
      return [MASTERS_SCOPE];
    }

    if (command.key === 'master:update' || command.key === 'master:delete') {
      return masterId
        ? [
            {
              kind: 'master',
              id: masterId,
              mode: 'exclusive',
            },
            INSTANCE_CASCADE_SCOPE,
          ]
        : [];
    }

    if (
      command.key === 'screen:add' ||
      command.key === 'screen:rename' ||
      command.key === 'screen:move'
    ) {
      return screenId
        ? [
            {
              kind: 'screen',
              id: screenId,
              mode: 'exclusive',
            },
          ]
        : [];
    }

    if (command.key === 'screen:update-frame' || command.key === 'screen:delete') {
      return screenId
        ? [
            {
              kind: 'screen',
              id: screenId,
              mode: 'exclusive',
            },
            INSTANCE_CASCADE_SCOPE,
          ]
        : [];
    }

    if (
      command.key === 'instance:add' ||
      command.key === 'instance:update' ||
      command.key === 'instance:delete'
    ) {
      return [
        ...(screenId
          ? [
              {
                kind: 'screen',
                id: screenId,
                mode: 'shared' as const,
              },
              {
                kind: 'layer',
                id: screenId,
                mode: 'shared' as const,
              },
            ]
          : []),
        ...(instanceId
          ? [
              {
                kind: 'instance',
                id: instanceId,
                mode: 'exclusive' as const,
              },
            ]
          : []),
        ...(masterId
          ? [
              {
                kind: 'master',
                id: masterId,
                mode: 'shared' as const,
              },
            ]
          : []),
        ...(command.key === 'instance:update' && screenId ? [INSTANCE_CASCADE_SCOPE] : []),
      ];
    }

    if (command.key === 'layer:move') {
      return [
        ...(screenId
          ? [
              {
                kind: 'screen',
                id: screenId,
                mode: 'shared' as const,
              },
              {
                kind: 'layer',
                id: screenId,
                mode: 'exclusive' as const,
              },
            ]
          : []),
        ...(instanceId
          ? [
              {
                kind: 'instance',
                id: instanceId,
                mode: 'shared' as const,
              },
            ]
          : []),
      ];
    }

    return [];
  }
}
