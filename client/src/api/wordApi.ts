import axiosInstance from './axiosInstance';
import { downloadBlob } from '@/lib/download';
import type {
  BulkSaveResponse,
  BulkValidationResponse,
  PagedResponse,
  Word,
  WordFormData,
} from '@/types/dictionary';

const BULK_FETCH_PAGE_SIZE = 5_000;

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

export async function createWord(teamId: string, setId: string, data: WordFormData): Promise<Word> {
  const res = await axiosInstance.post<Word>(`/teams/${teamId}/dictionary-sets/${setId}/words`, data);
  return res.data;
}

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

export async function deleteWord(teamId: string, setId: string, wordId: number): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/dictionary-sets/${setId}/words/${wordId}`);
}

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

export async function downloadWordTemplate(teamId: string, setId: string): Promise<void> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/dictionary-sets/${setId}/words/upload/template`,
    { responseType: 'blob' },
  );
  downloadBlob(res, 'word-template.xlsx');
}

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
