import axiosInstance from './axiosInstance';
import { downloadBlob } from '@/lib/download';
import type {
  Domain,
  DomainFormData,
  BulkValidationResponse,
  BulkSaveResponse,
} from '@/types/dictionary';

/**
 * 팀의 도메인 목록을 조회한다.
 *
 * @param teamId 조회할 팀 ID
 * @param setId  조회할 사전 세트 ID
 * @returns 도메인 목록
 */
export async function fetchDomains(teamId: string, setId: string): Promise<Domain[]> {
  const res = await axiosInstance.get<Domain[]>(`/teams/${teamId}/dictionary-sets/${setId}/domains`);
  return res.data;
}

/**
 * 새 도메인을 생성한다.
 *
 * @param teamId 도메인을 생성할 팀 ID
 * @param setId  생성 대상 사전 세트 ID
 * @param data   도메인 생성 데이터
 * @returns 생성된 도메인
 */
export async function createDomain(teamId: string, setId: string, data: DomainFormData): Promise<Domain> {
  const res = await axiosInstance.post<Domain>(`/teams/${teamId}/dictionary-sets/${setId}/domains`, data);
  return res.data;
}

/**
 * 도메인을 수정한다.
 *
 * @param teamId   도메인이 속한 팀 ID
 * @param setId    도메인이 속한 사전 세트 ID
 * @param domainId 수정할 도메인 ID
 * @param data     도메인 수정 데이터
 * @returns 수정된 도메인
 */
export async function updateDomain(
  teamId: string,
  setId: string,
  domainId: number,
  data: DomainFormData,
): Promise<Domain> {
  const res = await axiosInstance.put<Domain>(
    `/teams/${teamId}/dictionary-sets/${setId}/domains/${domainId}`,
    data,
  );
  return res.data;
}

/**
 * 도메인을 삭제한다.
 *
 * @param teamId   도메인이 속한 팀 ID
 * @param setId    도메인이 속한 사전 세트 ID
 * @param domainId 삭제할 도메인 ID
 */
export async function deleteDomain(teamId: string, setId: string, domainId: number): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/dictionary-sets/${setId}/domains/${domainId}`);
}

/**
 * 도메인 업로드 파일을 검증한다.
 *
 * @param teamId 대상 팀 ID
 * @param setId  대상 사전 세트 ID
 * @param file   업로드할 파일 (.xlsx 또는 .csv)
 * @returns 검증 결과
 */
export async function validateDomainUpload(
  teamId: string,
  setId: string,
  file: File,
): Promise<BulkValidationResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post<BulkValidationResponse>(
    `/teams/${teamId}/dictionary-sets/${setId}/domains/upload/validate`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
}

/**
 * 검증 통과한 도메인을 일괄 저장한다.
 *
 * @param teamId 대상 팀 ID
 * @param setId  대상 사전 세트 ID
 * @param rows   저장할 도메인 데이터 목록
 * @returns 저장 결과
 */
export async function bulkSaveDomains(
  teamId: string,
  setId: string,
  rows: DomainFormData[],
): Promise<BulkSaveResponse> {
  const res = await axiosInstance.post<BulkSaveResponse>(
    `/teams/${teamId}/dictionary-sets/${setId}/domains/upload`,
    {
    rows,
    },
  );
  return res.data;
}

/**
 * 도메인 템플릿 엑셀을 다운로드한다.
 *
 * Content-Disposition 헤더에서 서버가 전달한 파일명을 추출하여 사용한다.
 * Accept-Language 헤더가 자동 전송되므로 선택 언어에 맞는 템플릿이 반환된다.
 *
 * @param teamId 대상 팀 ID
 * @param setId  대상 사전 세트 ID
 */
export async function downloadDomainTemplate(teamId: string, setId: string): Promise<void> {
  const res = await axiosInstance.get(`/teams/${teamId}/dictionary-sets/${setId}/domains/upload/template`, {
    responseType: 'blob',
  });
  downloadBlob(res, 'domain-template.xlsx');
}
