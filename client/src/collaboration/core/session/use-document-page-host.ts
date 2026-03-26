import { useCallback, useMemo } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import type { DocumentBootstrapPayload } from '@/collaboration/core/contracts/document-bootstrap';

interface UseDocumentPageHostOptions<TDetail> {
  bootstrapQueryKey: QueryKey;
  bootstrapQueryFn: () => Promise<DocumentBootstrapPayload>;
  detailQueryKey: QueryKey;
  detailQueryFn: () => Promise<TDetail>;
  expectedPluginId: string;
  expectedEngineId: string;
  enabled: boolean;
}

interface UseDocumentPageHostResult<TDetail> {
  documentBootstrap: DocumentBootstrapPayload | undefined;
  documentDetail: TDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  retryDocumentSetup: () => Promise<void>;
}

/**
 * 문서 bootstrap 메타 조회와 상세 조회를 순차 조합한다.
 *
 * 프런트는 단일 bootstrap endpoint만 호출하고,
 * metadata/header 조합은 서버 내부 책임으로 남긴다.
 */
export function useDocumentPageHost<TDetail>({
  bootstrapQueryKey,
  bootstrapQueryFn,
  detailQueryKey,
  detailQueryFn,
  expectedPluginId,
  expectedEngineId,
  enabled,
}: UseDocumentPageHostOptions<TDetail>): UseDocumentPageHostResult<TDetail> {
  const bootstrapQuery = useQuery({
    queryKey: bootstrapQueryKey,
    queryFn: bootstrapQueryFn,
    enabled,
  });
  const bootstrapSupported = useMemo(
    () =>
      bootstrapQuery.data?.pluginId === expectedPluginId &&
      bootstrapQuery.data?.engineId === expectedEngineId,
    [
      bootstrapQuery.data?.engineId,
      bootstrapQuery.data?.pluginId,
      expectedEngineId,
      expectedPluginId,
    ],
  );
  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: detailQueryFn,
    enabled: enabled && bootstrapQuery.isSuccess && bootstrapSupported,
  });
  const retryDocumentSetup = useCallback(async () => {
    const bootstrapResult = await bootstrapQuery.refetch();
    const nextBootstrap = bootstrapResult.data;
    const nextBootstrapSupported =
      nextBootstrap?.pluginId === expectedPluginId && nextBootstrap?.engineId === expectedEngineId;
    if (!nextBootstrapSupported) {
      return;
    }
    await detailQuery.refetch();
  }, [bootstrapQuery, detailQuery, expectedEngineId, expectedPluginId]);

  return {
    documentBootstrap: bootstrapSupported ? bootstrapQuery.data : undefined,
    documentDetail: detailQuery.data,
    isLoading: bootstrapQuery.isLoading || (bootstrapSupported && detailQuery.isLoading),
    isError:
      bootstrapQuery.isError ||
      (bootstrapQuery.isSuccess && !bootstrapSupported) ||
      detailQuery.isError,
    retryDocumentSetup,
  };
}
