import axiosInstance from './axiosInstance';
import { downloadBlob } from '@/lib/download';
import type {
  BulkSaveResponse,
  BulkValidationResponse,
  PagedResponse,
  Word,
  WordFormData,
} from '@/types/dictionary';

/** 일괄 조회 시 페이지당 단어 수 */
const BULK_FETCH_PAGE_SIZE = 5_000;

/**
 * 팀·사전 세트에 속한 모든 단어를 페이지 순회하여 조회한다.
 *
 * @param teamId 팀 ID
 * @param setId  사전 세트 ID
 * @returns 전체 단어 목록
 */
export async function fetchWords(teamId: string, setId: string): Promise<Word[]> {
  const allWords: Word[] = [];
  const MAX_PAGES = 100;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const pageResult = await fetchWordsPage(teamId, setId, page, BULK_FETCH_PAGE_SIZE);
    allWords.push(...pageResult.content);
    if (pageResult.last) {
      return allWords;
    }
  }

  console.warn('[fetchWords] 페이지 상한 초과, 조회 중단');
  return allWords;
}

/**
 * 단어 목록을 페이지 단위로 조회한다.
 *
 * @param teamId  팀 ID
 * @param setId   사전 세트 ID
 * @param page    페이지 번호 (0-based)
 * @param size    페이지당 항목 수
 * @param keyword 검색 키워드 (선택)
 * @returns 페이징된 단어 목록
 */
export async function fetchWordsPage(
  teamId: string,
  setId: string,
  page: number,
  size: number,
  keyword?: string,
): Promise<PagedResponse<Word>> {
  const normalizedKeyword = keyword?.trim();
  const res = await axiosInstance.get<PagedResponse<Word>>(
    `/teams/${teamId}/dictionary-sets/${setId}/words`,
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
 * 새 단어를 생성한다.
 *
 * @param teamId 팀 ID
 * @param setId  사전 세트 ID
 * @param data   단어 생성 데이터
 * @returns 생성된 단어
 */
export async function createWord(teamId: string, setId: string, data: WordFormData): Promise<Word> {
  const res = await axiosInstance.post<Word>(
    `/teams/${teamId}/dictionary-sets/${setId}/words`,
    data,
  );
  return res.data;
}

/**
 * 기존 단어를 수정한다.
 *
 * @param teamId 팀 ID
 * @param setId  사전 세트 ID
 * @param wordId 수정할 단어 ID
 * @param data   단어 수정 데이터
 * @returns 수정된 단어
 */
export async function updateWord(
  teamId: string,
  setId: string,
  wordId: number,
  data: WordFormData,
): Promise<Word> {
  const res = await axiosInstance.put<Word>(
    `/teams/${teamId}/dictionary-sets/${setId}/words/${wordId}`,
    data,
  );
  return res.data;
}

/**
 * 단어를 삭제한다.
 *
 * @param teamId 팀 ID
 * @param setId  사전 세트 ID
 * @param wordId 삭제할 단어 ID
 */
export async function deleteWord(teamId: string, setId: string, wordId: number): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/dictionary-sets/${setId}/words/${wordId}`);
}

/**
 * 단어 일괄 업로드 파일의 유효성을 검증한다.
 *
 * @param teamId 팀 ID
 * @param setId  사전 세트 ID
 * @param file   업로드할 엑셀 파일
 * @returns 검증 결과 (토큰 + 오류 목록)
 */
export async function validateWordUpload(
  teamId: string,
  setId: string,
  file: File,
): Promise<BulkValidationResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post<BulkValidationResponse>(
    `/teams/${teamId}/dictionary-sets/${setId}/words/upload/validate`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
}

/**
 * 검증 완료된 단어들을 일괄 저장한다.
 *
 * @param teamId            팀 ID
 * @param setId             사전 세트 ID
 * @param validationToken   검증 시 발급받은 토큰
 * @param excludedRowNumbers 저장에서 제외할 행 번호 목록
 * @returns 저장 결과 (성공/실패 수)
 */
export async function bulkSaveWords(
  teamId: string,
  setId: string,
  validationToken: string,
  excludedRowNumbers: number[],
): Promise<BulkSaveResponse> {
  const res = await axiosInstance.post<BulkSaveResponse>(
    `/teams/${teamId}/dictionary-sets/${setId}/words/upload`,
    {
      validationToken,
      excludedRowNumbers,
    },
  );
  return res.data;
}

/**
 * 단어 업로드 템플릿 엑셀 파일을 다운로드한다.
 *
 * @param teamId 팀 ID
 * @param setId  사전 세트 ID
 */
export async function downloadWordTemplate(teamId: string, setId: string): Promise<void> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/dictionary-sets/${setId}/words/upload/template`,
    { responseType: 'blob' },
  );
  downloadBlob(res, 'word-template.xlsx');
}

/**
 * 단어 업로드 검증 오류 상세 엑셀 파일을 다운로드한다.
 *
 * @param teamId          팀 ID
 * @param setId           사전 세트 ID
 * @param validationToken 검증 시 발급받은 토큰
 */
export async function downloadWordUploadErrors(
  teamId: string,
  setId: string,
  validationToken: string,
): Promise<void> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/dictionary-sets/${setId}/words/upload/errors`,
    {
      params: { validationToken },
      responseType: 'blob',
    },
  );
  downloadBlob(res, 'word-upload-errors.xlsx');
}
