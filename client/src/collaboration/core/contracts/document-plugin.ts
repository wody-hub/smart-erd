import type {
  DocumentChangeEvent,
  DocumentMutation,
  DocumentReadExecutor,
  MutationMeta,
  ScopeRef,
} from './document-read-executor.js';

export interface DocumentCommand {
  key: string;
  payload?: Record<string, unknown>;
}

export interface ParseResult {
  payload?: unknown;
  diagnostics: string[];
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: string[];
}

export interface TextInputPipeline {
  parse(input: string): ParseResult;
  validate(result: ParseResult): ValidationResult;
  buildCommands(result: ParseResult): DocumentCommand[];
}

export interface TextInputAdapter {
  kind: 'text';
}

export interface CanvasInputAdapter {
  kind: 'canvas';
}

export interface FormInputAdapter {
  kind: 'form';
}

export interface PresenceAdapter {
  applyPresence(payload: GenericPresencePayload): void;
}

export interface InputAdapters {
  text?: TextInputAdapter;
  canvas?: CanvasInputAdapter;
  form?: FormInputAdapter;
  presence?: PresenceAdapter;
}

export interface MutationPolicy {
  toMutation(command: DocumentCommand, meta: MutationMeta): DocumentMutation;
}

export interface Projector {
  project(read: DocumentReadExecutor, event?: DocumentChangeEvent): void;
}

export interface ScopeResolver {
  resolve(command: DocumentCommand): ScopeRef[];
}

export interface AssetRef {
  assetId: string;
  kind: string;
  mimeType?: string;
  hash?: string;
}

export interface AssetPreloadHint {
  assetId: string;
  priority: 'eager' | 'lazy';
}

export interface AssetBinding {
  collectReferencedAssets(read: DocumentReadExecutor): AssetRef[];
  buildPreloadHints?(assets: AssetRef[]): AssetPreloadHint[];
}

export interface LocalPresenceState {
  pointer?: { x: number; y: number };
  selection?: string[];
  viewport?: { x: number; y: number; zoom: number };
  activeTool?: string;
  pluginState?: unknown;
}

export interface GenericPresencePayload {
  pointer?: { x: number; y: number };
  selection?: string[];
  viewport?: { x: number; y: number; zoom: number };
  activeTool?: string;
  pluginPayload?: unknown;
}

export interface PresenceMapper {
  toPresencePayload(state: LocalPresenceState): GenericPresencePayload;
  applyRemotePresence(payload: GenericPresencePayload, adapter: PresenceAdapter): void;
}

export interface ProjectionRefreshRequest {
  forceFull?: boolean;
  scopeHints?: ScopeRef[];
  nodeIds?: string[];
  edgeIds?: string[];
  groupIds?: string[];
}

export interface ProjectionBridge {
  refreshPersistedView(request?: ProjectionRefreshRequest): void;
}

export interface CompatibilityArtifactSerializer {
  artifactVersion: number;
  build(snapshot: Uint8Array): Uint8Array | null;
}

export interface CompatibilityArtifactCodec {
  restoreSnapshot(artifact: Uint8Array, artifactVersion: number): Uint8Array;
}

export interface PluginContext {
  read: DocumentReadExecutor;
  projectionBridge?: ProjectionBridge;
}

export interface BaseDocumentPlugin {
  pluginId: string;
  schemaVersion: number;
  supportedEngineIds: string[];
  createInputAdapters(context: PluginContext): InputAdapters;
  createMutationPolicy(context: PluginContext): MutationPolicy;
  createProjectors(context: PluginContext): Projector[];
  createScopeResolver(context: PluginContext): ScopeResolver;
}

export interface TextInputCapablePlugin extends BaseDocumentPlugin {
  createTextInputPipeline(context: PluginContext): TextInputPipeline;
}

export interface ArtifactFallbackCapablePlugin extends BaseDocumentPlugin {
  createArtifactSerializer(context: PluginContext): CompatibilityArtifactSerializer;
  createArtifactCodec(context: PluginContext): CompatibilityArtifactCodec;
}

export interface AssetCapablePlugin extends BaseDocumentPlugin {
  createAssetBinding(context: PluginContext): AssetBinding;
}

export interface PresenceCapablePlugin extends BaseDocumentPlugin {
  createPresenceMapper(context: PluginContext): PresenceMapper;
}

export type RegisteredDocumentPlugin = BaseDocumentPlugin;
