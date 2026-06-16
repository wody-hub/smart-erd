import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';
import type { Project } from '@/types/project';
import type { Team } from '@/types/team';
import type {
  AiChatConfirmationCandidate,
  AiChatContextKind,
  AiChatContextSnapshot,
} from '@/types/ai-chat';

export type AiChatContextOptionSource = 'authorized' | 'confirmation';

export interface AiChatContextOption {
  id: string;
  label: string;
  kind: Extract<AiChatContextKind, 'team' | 'project' | 'multi-project'>;
  teamId: string | number | null;
  teamName: string | null;
  projectId: string | number | null;
  projectName: string | null;
  source: AiChatContextOptionSource;
  reason?: string | null;
}

export interface BuildAiChatContextOptionsInput {
  teams: Team[];
  projects: Project[];
  confirmationCandidates?: AiChatConfirmationCandidate[];
}

export interface UseAiChatContextOptionsInput {
  teamId?: string | number | null;
  confirmationCandidates?: AiChatConfirmationCandidate[];
}

export interface UseAiChatContextOptionsResult {
  options: AiChatContextOption[];
  teams: Team[];
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
}

function normalizeId(value: string | number | null | undefined): string | null {
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return null;
}

function candidateLabel(candidate: AiChatConfirmationCandidate): string {
  return candidate.label || candidate.projectName || candidate.teamName || String(candidate.id);
}

function candidateOption(candidate: AiChatConfirmationCandidate): AiChatContextOption {
  return {
    id: `candidate:${candidate.id}`,
    label: candidateLabel(candidate),
    kind: candidate.kind,
    teamId: candidate.teamId,
    teamName: candidate.teamName ?? null,
    projectId: candidate.projectId ?? null,
    projectName: candidate.projectName ?? null,
    source: 'confirmation',
    reason: candidate.reason ?? null,
  };
}

async function loadAuthorizedTeams() {
  const { fetchTeams } = await import('@/api/teamApi');
  return fetchTeams();
}

async function loadAuthorizedProjects(teamId: string) {
  const { fetchProjects } = await import('@/api/projectApi');
  return fetchProjects(teamId);
}

export function createAiChatContextOptionQueryKeys(teamId?: string | number | null) {
  const normalizedTeamId = normalizeId(teamId);
  return {
    teams: queryKeys.teams.all,
    projects: normalizedTeamId ? queryKeys.projects.byTeam(normalizedTeamId) : null,
  };
}

export function buildAiChatContextOptions({
  teams,
  projects,
  confirmationCandidates = [],
}: BuildAiChatContextOptionsInput): AiChatContextOption[] {
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  return [
    ...teams.map(
      (team): AiChatContextOption => ({
        id: `team:${team.id}`,
        label: team.name,
        kind: 'team',
        teamId: team.id,
        teamName: team.name,
        projectId: null,
        projectName: null,
        source: 'authorized',
      }),
    ),
    ...projects.map(
      (project): AiChatContextOption => ({
        id: `project:${project.teamId}:${project.id}`,
        label: project.name,
        kind: 'project',
        teamId: project.teamId,
        teamName: teamNameById.get(project.teamId) ?? null,
        projectId: project.id,
        projectName: project.name,
        source: 'authorized',
      }),
    ),
    ...confirmationCandidates.map(candidateOption),
  ];
}

export function createAiChatContextFromOption(
  option: AiChatContextOption,
  now: () => string = () => new Date().toISOString(),
): AiChatContextSnapshot {
  return {
    kind: option.kind,
    teamId: option.teamId,
    teamName: option.teamName,
    projectId: option.projectId,
    projectName: option.projectName,
    source: 'manual',
    capturedAt: now(),
    confidence: option.kind === 'project' ? 'strong' : 'team',
    scopeRequired: option.kind === 'project' ? false : true,
  };
}

export function useAiChatContextOptions({
  teamId,
  confirmationCandidates = [],
}: UseAiChatContextOptionsInput = {}): UseAiChatContextOptionsResult {
  const normalizedTeamId = normalizeId(teamId);
  const keys = createAiChatContextOptionQueryKeys(normalizedTeamId);
  const teamsQuery = useQuery({
    queryKey: keys.teams,
    queryFn: loadAuthorizedTeams,
    staleTime: 60_000,
  });
  const projectsQuery = useQuery({
    queryKey: keys.projects ?? ['teams', 'none', 'projects'],
    queryFn: () => loadAuthorizedProjects(normalizedTeamId ?? ''),
    enabled: normalizedTeamId !== null,
    staleTime: 60_000,
  });
  const teams = teamsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const options = useMemo(
    () => buildAiChatContextOptions({ teams, projects, confirmationCandidates }),
    [confirmationCandidates, projects, teams],
  );

  return {
    options,
    teams,
    projects,
    isLoading: teamsQuery.isLoading || projectsQuery.isLoading,
    isError: teamsQuery.isError || projectsQuery.isError,
  };
}
