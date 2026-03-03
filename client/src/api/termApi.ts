import axiosInstance from './axiosInstance';
import { downloadBlob } from '@/lib/download';
import type {
  Term,
  TermFormData,
  PagedResponse,
  BulkValidationResponse,
  BulkSaveResponse,
} from '@/types/dictionary';

const BULK_FETCH_PAGE_SIZE = 200;

/**
 * 팀의 용어 목록을 조회한다.
 *
 * @param teamId 조회할 팀 ID
 * @param setId  조회할 사전 세트 ID
 * @returns 용어 목록
 */
export async function fetchTerms(teamId: string, setId: string): Promise<Term[]> {
  const allTerms: Term[] = [];
  const MAX_PAGES = 100;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const pageResult = await fetchTermsPage(teamId, setId, page, BULK_FETCH_PAGE_SIZE);
    allTerms.push(...pageResult.content);
    if (pageResult.last) {
      return allTerms;
    }
  }
  console.warn('[fetchTerms] 페이지 상한 초과, 조회 중단');
  return allTerms;
}

/**
 * 팀의 용어 목록을 페이지 단위로 조회한다.
 *
 * @param teamId 조회할 팀 ID
 * @param setId  조회할 사전 세트 ID
 * @param page   페이지 번호 (0-base)
 * @param size   페이지 크기
 * @returns 페이징 응답
 */
export async function fetchTermsPage(
  teamId: string,
  setId: string,
  page: number,
  size: number,
  keyword?: string,
): Promise<PagedResponse<Term>> {
  const normalizedKeyword = keyword?.trim();
  const res = await axiosInstance.get<PagedResponse<Term>>(
    `/teams/${teamId}/dictionary-sets/${setId}/terms`,
    {
      params: {
        page,
        size,
        ...(normalizedKeyword ? { q: normalizedKeyword } : {}),
      },
    },
  );
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
 * @param teamId            대상 팀 ID
 * @param setId             대상 사전 세트 ID
 * @param validationToken   검증 세션 토큰
 * @param excludedRowNumbers 저장에서 제외할 행 번호 목록
 * @returns 저장 결과
 */
export async function bulkSaveTerms(
  teamId: string,
  setId: string,
  validationToken: string,
  excludedRowNumbers: number[],
): Promise<BulkSaveResponse> {
  const res = await axiosInstance.post<BulkSaveResponse>(
    `/teams/${teamId}/dictionary-sets/${setId}/terms/upload`,
    {
      validationToken,
      excludedRowNumbers,
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

/**
 * 업로드 검증 오류 행 엑셀을 다운로드한다.
 *
 * @param teamId          대상 팀 ID
 * @param setId           대상 사전 세트 ID
 * @param validationToken 검증 세션 토큰
 */
export async function downloadTermUploadErrors(
  teamId: string,
  setId: string,
  validationToken: string,
): Promise<void> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/dictionary-sets/${setId}/terms/upload/errors`,
    {
      params: { validationToken },
      responseType: 'blob',
    },
  );
  downloadBlob(res, 'term-upload-errors.xlsx');
}
