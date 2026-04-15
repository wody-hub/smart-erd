import type {
  DocumentCommand,
  MutationPolicy,
} from '@/collaboration/core/contracts/document-plugin';
import type {
  DocumentMutation,
  MutationMeta,
} from '@/collaboration/core/contracts/document-read-executor';
import type { ScopeResolver } from '@/collaboration/core/contracts/document-plugin';

/**
 * 화면기획 골격 단계의 command를 공통 mutation 형태로 감싼다.
 */
export class ScreenSpecMutationPolicy implements MutationPolicy {
  constructor(private readonly scopeResolver: ScopeResolver) {}

  /**
   * 화면기획 command를 공통 mutation 구조로 감싼다.
   *
   * @param command 변환할 문서 command
   * @param meta 적용 메타데이터
   * @returns scope가 해석된 mutation
   */
  toMutation(command: DocumentCommand, meta: MutationMeta): DocumentMutation {
    void meta;
    return {
      key: command.key,
      payload: command.payload,
      affectedScopes: this.scopeResolver.resolve(command),
    };
  }
}
