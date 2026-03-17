import axiosInstance from './axiosInstance';
import type { Team, TeamMember, MyRoleResponse } from '@/types/team';

/**
 * 사용자가 속한 팀 목록을 조회한다.
 *
 * @returns 팀 목록
 */
export async function fetchTeams(): Promise<Team[]> {
  const res = await axiosInstance.get<Team[]>('/teams');
  return res.data;
}

/**
 * 팀 상세 정보를 조회한다.
 *
 * @param teamId 조회할 팀 ID
 * @returns 팀 상세 정보
 */
export async function fetchTeam(teamId: string): Promise<Team> {
  const res = await axiosInstance.get<Team>(`/teams/${teamId}`);
  return res.data;
}

/**
 * 새 팀을 생성한다.
 *
 * @param name 팀 이름
 * @returns 생성된 팀
 */
export async function createTeam(name: string): Promise<Team> {
  const res = await axiosInstance.post<Team>('/teams', { name });
  return res.data;
}

/**
 * 팀의 멤버 목록을 조회한다.
 *
 * @param teamId 조회할 팀 ID
 * @returns 팀 멤버 목록
 */
export async function fetchMembers(teamId: string): Promise<TeamMember[]> {
  const res = await axiosInstance.get<TeamMember[]>(`/teams/${teamId}/members`);
  return res.data;
}

/**
 * 팀에 멤버를 초대한다.
 *
 * @param teamId  대상 팀 ID
 * @param loginId 초대할 사용자 로그인 ID
 * @param role    부여할 역할 (MEMBER, VIEWER)
 */
export async function inviteMember(teamId: string, loginId: string, role: string): Promise<void> {
  await axiosInstance.post(`/teams/${teamId}/members`, { loginId, role });
}

/**
 * 팀에서 멤버를 제거한다.
 *
 * @param teamId 대상 팀 ID
 * @param userId 제거할 사용자 ID
 */
export async function removeMember(teamId: string, userId: number): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/members/${userId}`);
}

/**
 * 현재 사용자의 팀 내 역할을 조회한다.
 *
 * @param teamId 팀 ID
 * @returns 내 역할 응답
 */
export async function fetchMyRole(teamId: string): Promise<MyRoleResponse> {
  const res = await axiosInstance.get<MyRoleResponse>(`/teams/${teamId}/me`);
  return res.data;
}

/**
 * 팀 이름을 변경한다.
 *
 * @param teamId 팀 ID
 * @param name   새 팀 이름
 * @returns 수정된 팀 응답
 */
export async function updateTeam(teamId: string, name: string): Promise<Team> {
  const res = await axiosInstance.put<Team>(`/teams/${teamId}`, { name });
  return res.data;
}

/**
 * 팀을 삭제한다.
 *
 * @param teamId 삭제할 팀 ID
 */
export async function deleteTeam(teamId: string): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}`);
}
