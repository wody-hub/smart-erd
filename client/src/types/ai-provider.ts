export type AiProviderAvailability =
  | 'AVAILABLE'
  | 'NOT_CONFIGURED'
  | 'CODEX_NOT_FOUND'
  | 'CODEX_NOT_LOGGED_IN'
  | 'UNSUPPORTED_ENVIRONMENT';

export type AiProviderDisplayAvailability = AiProviderAvailability | 'CHECKING' | 'UNKNOWN';

export type AiExecutionStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'CANCELLED';

export type AiActionRiskLevel = 'LOW' | 'MEDIUM';

export type AiProviderStatusTone = 'ready' | 'warning' | 'error' | 'muted';

export type AiProviderAvailabilityLabelKey =
  | 'aiProvider.availability.available'
  | 'aiProvider.availability.notConfigured'
  | 'aiProvider.availability.codexNotFound'
  | 'aiProvider.availability.codexNotLoggedIn'
  | 'aiProvider.availability.unsupportedEnvironment'
  | 'aiProvider.availability.checking'
  | 'aiProvider.availability.unknown';

export interface AiProviderAvailabilityPresentation {
  labelKey: AiProviderAvailabilityLabelKey;
  tone: AiProviderStatusTone;
}

export interface AiProviderStatusResponse {
  provider: string;
  availability: AiProviderAvailability;
  message: string | null;
  checkedAt: string;
}

export interface AiSelectedResourceRequest {
  type: string;
  id: number;
}

export interface AiProviderExecuteRequest {
  teamId: number;
  projectId: number;
  userMessage: string;
  locale?: string | null;
  selectedResource?: AiSelectedResourceRequest | null;
}

export interface AiProviderErrorResponse {
  type: string;
  title: string;
  detail: string;
  retryable: boolean;
}

export interface AiActionDraftResponse {
  id: string;
  type: string;
  title: string;
  summary: string;
  riskLevel: AiActionRiskLevel;
  requiresApproval: boolean;
  payload: Record<string, unknown>;
}

export interface AiExecutionStatusResponse {
  executionId: string;
  provider: string;
  status: AiExecutionStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  answer: string | null;
  actions: AiActionDraftResponse[];
  error: AiProviderErrorResponse | null;
}

export type AiProviderExecuteResponse = AiExecutionStatusResponse;

const AI_PROVIDER_AVAILABILITIES = new Set<string>([
  'AVAILABLE',
  'NOT_CONFIGURED',
  'CODEX_NOT_FOUND',
  'CODEX_NOT_LOGGED_IN',
  'UNSUPPORTED_ENVIRONMENT',
]);

const AI_PROVIDER_AVAILABILITY_PRESENTATION: Record<
  AiProviderDisplayAvailability,
  AiProviderAvailabilityPresentation
> = {
  AVAILABLE: {
    labelKey: 'aiProvider.availability.available',
    tone: 'ready',
  },
  NOT_CONFIGURED: {
    labelKey: 'aiProvider.availability.notConfigured',
    tone: 'warning',
  },
  CODEX_NOT_FOUND: {
    labelKey: 'aiProvider.availability.codexNotFound',
    tone: 'error',
  },
  CODEX_NOT_LOGGED_IN: {
    labelKey: 'aiProvider.availability.codexNotLoggedIn',
    tone: 'warning',
  },
  UNSUPPORTED_ENVIRONMENT: {
    labelKey: 'aiProvider.availability.unsupportedEnvironment',
    tone: 'muted',
  },
  CHECKING: {
    labelKey: 'aiProvider.availability.checking',
    tone: 'muted',
  },
  UNKNOWN: {
    labelKey: 'aiProvider.availability.unknown',
    tone: 'muted',
  },
};

export function isAiProviderAvailability(value: unknown): value is AiProviderAvailability {
  return typeof value === 'string' && AI_PROVIDER_AVAILABILITIES.has(value);
}

export function getAiProviderAvailabilityPresentation(
  availability: AiProviderDisplayAvailability,
): AiProviderAvailabilityPresentation {
  return AI_PROVIDER_AVAILABILITY_PRESENTATION[availability];
}
