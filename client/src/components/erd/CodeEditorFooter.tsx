import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';

/**
 * CodeEditorFooter 컴포넌트의 props.
 */
interface CodeEditorFooterProps {
  /** Apply 버튼 클릭 핸들러 */
  onApply: () => void;
  /** Apply 버튼 활성화 여부 */
  canApply: boolean;
  /** Apply 확인 다이얼로그 실행 함수 */
  executeApply: () => void;
  /** Apply 확인 다이얼로그 열림 상태 */
  confirmOpen: boolean;
  /** Apply 확인 다이얼로그 열림 상태 세터 */
  setConfirmOpen: (open: boolean) => void;
  /** Apply 확인 다이얼로그 제목 (미지정 시 기본 번역 키 사용) */
  confirmTitle?: string;
  /** Apply 확인 다이얼로그 설명 (미지정 시 기본 번역 키 사용) */
  confirmDescription?: string;
  /** Refresh 버튼 클릭 핸들러 */
  onRefresh: () => void;
  /** Refresh 실행 함수 (확인 다이얼로그에서 사용) */
  executeRefresh: () => void;
  /** ERD에 노드가 있는지 여부 (Refresh 비활성화 판단) */
  hasNodes: boolean;
  /** Refresh 확인 다이얼로그 열림 상태 */
  refreshConfirmOpen: boolean;
  /** Refresh 확인 다이얼로그 열림 상태 세터 */
  setRefreshConfirmOpen: (open: boolean) => void;
  /** 파싱 상태 표시 영역 (에디터별 커스텀 렌더링) */
  children: ReactNode;
}

/**
 * 코드 에디터 하단 공통 푸터.
 *
 * 파싱 상태 표시, Apply/Refresh 버튼, 확인 다이얼로그를
 * SQL DDL 에디터와 논리명 DSL 에디터에서 공유한다.
 * 파싱 상태 표시 영역은 children으로 에디터별 커스텀 렌더링을 주입받는다.
 *
 * @param props 컴포넌트 props
 * @returns 코드 에디터 하단 푸터 JSX
 */
export default function CodeEditorFooter({
  onApply,
  canApply,
  executeApply,
  confirmOpen,
  setConfirmOpen,
  confirmTitle,
  confirmDescription,
  onRefresh,
  executeRefresh,
  hasNodes,
  refreshConfirmOpen,
  setRefreshConfirmOpen,
  children,
}: CodeEditorFooterProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="px-3 py-2 border-t border-border shrink-0 space-y-2">
        {/* 파싱 상태 (에디터별 커스텀) */}
        {children}

        {/* Apply + Refresh 버튼 */}
        <div className="flex gap-1.5">
          <Button className="flex-1 gap-1.5" size="sm" onClick={onApply} disabled={!canApply}>
            <Play className="h-3.5 w-3.5" />
            {t('erd.codeEditor.applyButton')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={!hasNodes}
            aria-label={t('erd.codeEditor.refreshButton')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 교체 확인 다이얼로그 */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle ?? t('erd.codeEditor.confirmTitle')}
        description={confirmDescription ?? t('erd.codeEditor.confirmDescription')}
        onConfirm={executeApply}
      />

      {/* Refresh 확인 다이얼로그 */}
      <ConfirmDialog
        open={refreshConfirmOpen}
        onOpenChange={setRefreshConfirmOpen}
        title={t('erd.codeEditor.refreshConfirmTitle')}
        description={t('erd.codeEditor.refreshConfirmDescription')}
        onConfirm={executeRefresh}
      />
    </>
  );
}
