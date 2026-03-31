import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EdgeRoutingType } from '@/types/erd';
import type { EdgeHandleSelectionValue } from '@/lib/edge-handles';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** EdgeContextMenu 컴포넌트의 props. */
interface EdgeContextMenuProps {
  /** 메뉴 표시 위치 (화면 좌표) */
  position: { x: number; y: number };
  /** 현재 라우팅 타입 */
  routingType: EdgeRoutingType;
  /** 현재 handle selection */
  handleSelection: EdgeHandleSelectionValue;
  /** 현재 테이블 layout 기준으로 허용되는 handle selection */
  allowedHandleSelections: EdgeHandleSelectionValue[];
  /** 라우팅 타입 변경 핸들러 */
  onRoutingTypeChange: (routingType: EdgeRoutingType) => void;
  /** handle selection 변경 핸들러 */
  onHandleSelectionChange: (selection: EdgeHandleSelectionValue) => void;
  /** 경로 초기화 가능 여부 */
  canResetPath: boolean;
  /** 경로 초기화 핸들러 */
  onResetPath: () => void;
  /** 원격 락 상태 */
  lockedByName?: string | null;
  /** 삭제 클릭 핸들러 */
  onDelete: () => void;
  /** 메뉴 닫기 핸들러 */
  onClose: () => void;
}

/**
 * 엣지 우클릭 컨텍스트 메뉴.
 *
 * 우클릭 좌표 기준으로 라우팅 타입 선택과 연결 삭제를 제공한다.
 *
 * @param props.position 메뉴 표시 위치 (화면 좌표)
 * @param props.routingType 현재 라우팅 타입
 * @param props.onRoutingTypeChange 라우팅 타입 변경 핸들러
 * @param props.onDelete 삭제 클릭 핸들러
 * @param props.onClose 메뉴 닫기 핸들러
 */
export default function EdgeContextMenu({
  position,
  routingType,
  handleSelection,
  allowedHandleSelections,
  onRoutingTypeChange,
  onHandleSelectionChange,
  canResetPath,
  onResetPath,
  lockedByName,
  onDelete,
  onClose,
}: EdgeContextMenuProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isLocked = !!lockedByName;

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          className="fixed h-0 w-0 opacity-0 pointer-events-none"
          style={{ left: position.x, top: position.y }}
          aria-label={t('erd.edge.contextMenuAria')}
          tabIndex={-1}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" sideOffset={6} className="min-w-[220px]">
        {isLocked && (
          <DropdownMenuLabel>{t('erd.edge.lockedBy', { name: lockedByName })}</DropdownMenuLabel>
        )}
        <DropdownMenuLabel>{t('erd.edge.contextRouting')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={routingType}
          onValueChange={(value) => onRoutingTypeChange(value as EdgeRoutingType)}
        >
          <DropdownMenuRadioItem value="smoothstep" disabled={isLocked}>
            <div className="flex flex-col">
              <span>{t('erd.edge.routingSmoothstep')}</span>
              <span className="text-xs text-muted-foreground">
                {t('erd.edge.routingSmoothstepDescription')}
              </span>
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bezier" disabled={isLocked}>
            <div className="flex flex-col">
              <span>{t('erd.edge.routingBezier')}</span>
              <span className="text-xs text-muted-foreground">
                {t('erd.edge.routingBezierDescription')}
              </span>
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="straight" disabled={isLocked}>
            <div className="flex flex-col">
              <span>{t('erd.edge.routingStraight')}</span>
              <span className="text-xs text-muted-foreground">
                {t('erd.edge.routingStraightDescription')}
              </span>
            </div>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('erd.edge.contextHandleSide')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={handleSelection}
          onValueChange={(value) => onHandleSelectionChange(value as EdgeHandleSelectionValue)}
        >
          <DropdownMenuRadioItem value="auto" disabled={isLocked}>
            {t('erd.edge.handleAuto')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="left-left"
            disabled={isLocked || !allowedHandleSelections.includes('left-left')}
          >
            {t('erd.edge.handleLeftLeft')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="left-right"
            disabled={isLocked || !allowedHandleSelections.includes('left-right')}
          >
            {t('erd.edge.handleLeftRight')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="right-left"
            disabled={isLocked || !allowedHandleSelections.includes('right-left')}
          >
            {t('erd.edge.handleRightLeft')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="right-right"
            disabled={isLocked || !allowedHandleSelections.includes('right-right')}
          >
            {t('erd.edge.handleRightRight')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isLocked || !canResetPath}
          onSelect={(event) => {
            event.preventDefault();
            if (isLocked || !canResetPath) {
              return;
            }
            onResetPath();
          }}
        >
          {t('erd.edge.contextResetPath')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isLocked}
          onSelect={(event) => {
            event.preventDefault();
            if (isLocked) {
              return;
            }
            onDelete();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('erd.edge.contextDelete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
