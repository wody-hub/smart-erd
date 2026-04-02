import * as Y from 'yjs';
import type {
  ArtifactFallbackCapablePlugin,
  CompatibilityArtifactCodec,
  CompatibilityArtifactSerializer,
  DocumentCommand,
  InputAdapters,
  MutationPolicy,
  PluginContext,
  Projector,
  ScopeResolver,
} from '@/collaboration/core/contracts/document-plugin';
import type {
  DocumentMutation,
  MutationMeta,
  ScopeRef,
} from '@/collaboration/core/contracts/document-read-executor';
import { YJS_SHARED_DOCUMENT_ENGINE_ID } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { MarkdownYjsDocumentAdapter } from '@/collaboration/yjs/markdown-yjs-document-adapter';

export const MARKDOWN_DOCUMENT_PLUGIN_ID = 'markdown';
export const MARKDOWN_DOCUMENT_ENGINE_ID = YJS_SHARED_DOCUMENT_ENGINE_ID;

const MARKDOWN_PLUGIN_SCHEMA_VERSION = 1;
const MARKDOWN_COMPATIBILITY_ARTIFACT_VERSION = 1;

/**
 * markdown command scope를 해석한다.
 */
class MarkdownScopeResolver implements ScopeResolver {
  resolve(command: DocumentCommand): ScopeRef[] {
    switch (command.key) {
      case 'markdown:section-update': {
        const sectionId =
          typeof command.payload?.sectionId === 'string' ? command.payload.sectionId : null;
        if (!sectionId) {
          return [rootScope()];
        }
        return [
          {
            kind: 'section',
            id: sectionId,
            mode: 'exclusive',
          },
        ];
      }
      case 'markdown:body-replace':
      case 'markdown:frontmatter-update':
      default:
        return [rootScope()];
    }
  }
}

/**
 * markdown command를 공통 DocumentMutation 형태로 변환한다.
 */
class MarkdownMutationPolicy implements MutationPolicy {
  constructor(private readonly scopeResolver: ScopeResolver) {}

  toMutation(command: DocumentCommand, _meta: MutationMeta): DocumentMutation {
    return {
      key: command.key,
      payload: command.payload,
      affectedScopes: this.scopeResolver.resolve(command),
    };
  }
}

/**
 * markdown snapshot을 compatibility artifact buffer로 직렬화한다.
 */
class MarkdownArtifactSerializer implements CompatibilityArtifactSerializer {
  readonly artifactVersion = MARKDOWN_COMPATIBILITY_ARTIFACT_VERSION;

  build(snapshot: Uint8Array): Uint8Array {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, snapshot, 'bootstrap');
    const buffer = new MarkdownYjsDocumentAdapter().serializeBuffer(doc);
    return new TextEncoder().encode(buffer);
  }
}

/**
 * markdown compatibility artifact buffer를 snapshot으로 복원한다.
 */
class MarkdownArtifactCodec implements CompatibilityArtifactCodec {
  restoreSnapshot(artifact: Uint8Array, _artifactVersion: number): Uint8Array {
    const doc = new Y.Doc();
    const buffer = new TextDecoder().decode(artifact);
    new MarkdownYjsDocumentAdapter().replaceBuffer(doc, buffer, 'bootstrap');
    return Y.encodeStateAsUpdate(doc);
  }
}

/**
 * markdown 문서 타입의 최소 collaboration plugin 구현.
 */
export class MarkdownDocumentPlugin implements ArtifactFallbackCapablePlugin {
  readonly pluginId = MARKDOWN_DOCUMENT_PLUGIN_ID;
  readonly schemaVersion = MARKDOWN_PLUGIN_SCHEMA_VERSION;
  readonly supportedEngineIds = [MARKDOWN_DOCUMENT_ENGINE_ID];

  createInputAdapters(_context: PluginContext): InputAdapters {
    return {
      text: {
        kind: 'text',
      },
      form: {
        kind: 'form',
      },
    };
  }

  createMutationPolicy(_context: PluginContext): MutationPolicy {
    return new MarkdownMutationPolicy(this.createScopeResolver(_context));
  }

  createProjectors(_context: PluginContext): Projector[] {
    return [];
  }

  createScopeResolver(_context: PluginContext): ScopeResolver {
    return new MarkdownScopeResolver();
  }

  createArtifactSerializer(_context: PluginContext): CompatibilityArtifactSerializer {
    return new MarkdownArtifactSerializer();
  }

  createArtifactCodec(_context: PluginContext): CompatibilityArtifactCodec {
    return new MarkdownArtifactCodec();
  }
}

/**
 * markdown document plugin 인스턴스를 생성한다.
 *
 * @returns markdown document plugin
 */
export function createMarkdownDocumentPlugin(): MarkdownDocumentPlugin {
  return new MarkdownDocumentPlugin();
}

function rootScope(): ScopeRef {
  return {
    kind: 'document',
    id: 'root',
    mode: 'exclusive',
  };
}
