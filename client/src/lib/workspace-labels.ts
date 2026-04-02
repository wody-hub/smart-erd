import type { WorkspaceContext, WorkspaceDocumentType, WorkspaceSection } from '@/types/workspace';

export type WorkspaceLabelKey =
  | 'workspace.section.teams'
  | 'workspace.section.projects'
  | 'workspace.section.documents'
  | 'workspace.section.dictionary'
  | 'workspace.section.members'
  | 'workspace.section.settings'
  | 'workspace.documentType.erd'
  | 'workspace.documentType.markdown'
  | 'workspace.documentType.screenSpec'
  | 'workspace.documents.title'
  | 'workspace.action.newErdDocument'
  | 'workspace.action.newMarkdownDocument'
  | 'workspace.action.newScreenSpecDocument';

/** i18n 번역 함수에 바로 넘길 수 있는 key + params 형태의 라벨 토큰. */
export interface WorkspaceLabelToken<TKey extends WorkspaceLabelKey = WorkspaceLabelKey> {
  /** i18next translation key */
  key: TKey;
  /** 보간 값 */
  values?: Record<string, string | number>;
}

/** workspace 상위 섹션 라벨 key. */
const WORKSPACE_SECTION_LABELS: Record<WorkspaceSection, WorkspaceLabelToken> = {
  teams: { key: 'workspace.section.teams' },
  projects: { key: 'workspace.section.projects' },
  documents: { key: 'workspace.section.documents' },
  dictionary: { key: 'workspace.section.dictionary' },
  members: { key: 'workspace.section.members' },
  settings: { key: 'workspace.section.settings' },
};

/** 문서 타입 라벨 key. */
const WORKSPACE_DOCUMENT_TYPE_LABELS: Record<WorkspaceDocumentType, WorkspaceLabelToken> = {
  erd: { key: 'workspace.documentType.erd' },
  markdown: { key: 'workspace.documentType.markdown' },
  'screen-spec': { key: 'workspace.documentType.screenSpec' },
};

/** 문서 생성 CTA 라벨 key. */
const WORKSPACE_NEW_DOCUMENT_LABELS: Record<WorkspaceDocumentType, WorkspaceLabelToken> = {
  erd: { key: 'workspace.action.newErdDocument' },
  markdown: { key: 'workspace.action.newMarkdownDocument' },
  'screen-spec': { key: 'workspace.action.newScreenSpecDocument' },
};

/** 현재 섹션 라벨을 반환한다. */
export function getWorkspaceSectionLabel(section: WorkspaceSection): WorkspaceLabelToken {
  return WORKSPACE_SECTION_LABELS[section];
}

/** 현재 문서 타입 라벨을 반환한다. */
export function getWorkspaceDocumentTypeLabel(
  documentType: WorkspaceDocumentType,
): WorkspaceLabelToken {
  return WORKSPACE_DOCUMENT_TYPE_LABELS[documentType];
}

/** 새 문서 생성 CTA 라벨을 반환한다. */
export function getWorkspaceNewDocumentLabel(
  documentType: WorkspaceDocumentType,
): WorkspaceLabelToken {
  return WORKSPACE_NEW_DOCUMENT_LABELS[documentType];
}

/** 문서 허브 기본 타이틀 라벨을 반환한다. */
export function getWorkspaceDocumentsTitleLabel(): WorkspaceLabelToken {
  return { key: 'workspace.documents.title' };
}

/** 현재 context에서 해석된 문서 타입을 반환한다. */
export function resolveWorkspaceDocumentType(
  context: Pick<WorkspaceContext, 'documentType' | 'document'>,
): WorkspaceDocumentType | undefined {
  return context.documentType ?? context.document?.type;
}
