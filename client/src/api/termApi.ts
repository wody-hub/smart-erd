import axiosInstance from './axiosInstance';
import { downloadBlob } from '@/lib/download';
import type {
  Term,
  TermFormData,
  BulkTermRow,
  BulkValidationResponse,
  BulkSaveResponse,
} from '@/types/dictionary';

/**
 * 팀의 용어 목록을 조회한다.
 *
 * @param teamId 조회할 팀 ID
 * @param setId  조회할 사전 세트 ID
 * @returns 용어 목록
 */
export async function fetchTerms(teamId: string, setId: string): Promise<Term[]> {
  const res = await axiosInstance.get<Term[]>(`/teams/${teamId}/dictionary-sets/${setId}/terms`);
  return res.data;
}

/**
 * 새 용어를 생성한다.
 *
 * @param teamId 용어를 생성할 팀 ID
 * @param setId  생성 대상 사전 세트 ID
 * @param data   용어 생성 데이터
 * @returns 생성된 용어
 */
export async function createTerm(teamId: string, setId: string, data: TermFormData): Promise<Term> {
  const res = await axiosInstance.post<Term>(
    `/teams/${teamId}/dictionary-sets/${setId}/terms`,
    data,
  );
  return res.data;
}

/**
 * 용어를 수정한다.
 *
 * @param teamId 용어가 속한 팀 ID
 * @param setId  용어가 속한 사전 세트 ID
 * @param termId 수정할 용어 ID
 * @param data   용어 수정 데이터
 * @returns 수정된 용어
 */
export async function updateTerm(
  teamId: string,
  setId: string,
  termId: number,
  data: TermFormData,
): Promise<Term> {
  const res = await axiosInstance.put<Term>(
    `/teams/${teamId}/dictionary-sets/${setId}/terms/${termId}`,
    data,
  );
  return res.data;
}

/**
 * 용어를 삭제한다.
 *
 * @param teamId 용어가 속한 팀 ID
 * @param setId  용어가 속한 사전 세트 ID
 * @param termId 삭제할 용어 ID
 */
export async function deleteTerm(teamId: string, setId: string, termId: number): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/dictionary-sets/${setId}/terms/${termId}`);
}

/**
 * 용어 업로드 파일을 검증한다.
 *
 * @param teamId 대상 팀 ID
 * @param setId  대상 사전 세트 ID
 * @param file   업로드할 파일 (.xlsx 또는 .csv)
 * @returns 검증 결과
 */
export async function validateTermUpload(
  teamId: string,
  setId: string,
  file: File,
): Promise<BulkValidationResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post<BulkValidationResponse>(
    `/teams/${teamId}/dictionary-sets/${setId}/terms/upload/validate`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
}

/**
 * 검증 통과한 용어를 일괄 저장한다.
 *
 * @param teamId 대상 팀 ID
 * @param setId  대상 사전 세트 ID
 * @param rows   저장할 용어 데이터 목록
 * @returns 저장 결과
 */
export async function bulkSaveTerms(
  teamId: string,
  setId: string,
  rows: BulkTermRow[],
): Promise<BulkSaveResponse> {
  const res = await axiosInstance.post<BulkSaveResponse>(
    `/teams/${teamId}/dictionary-sets/${setId}/terms/upload`,
    {
      rows,
    },
  );
  return res.data;
}

/**
 * 용어 템플릿 엑셀을 다운로드한다.
 *
 * Content-Disposition 헤더에서 서버가 전달한 파일명을 추출하여 사용한다.
 * Accept-Language 헤더가 자동 전송되므로 선택 언어에 맞는 템플릿이 반환된다.
 *
 * @param teamId 대상 팀 ID
 * @param setId  대상 사전 세트 ID
 */
export async function downloadTermTemplate(teamId: string, setId: string): Promise<void> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/dictionary-sets/${setId}/terms/upload/template`,
    {
      responseType: 'blob',
    },
  );
  downloadBlob(res, 'term-template.xlsx');
}
