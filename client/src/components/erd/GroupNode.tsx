import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import type { GroupNode as GroupNodeType } from '@/types/erd';
import { TABLE_COLORS } from '@/lib/table-colors';
import useCanvasStore from '@/stores/useCanvasStore';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { useErdPermission } from './ErdPermissionContext';
import { KEYS } from '@/constants/keybindings';

/**
 * ERD 그룹 커스텀 노드 컴포넌트.
 *
 * 여러 테이블을 시각적으로 묶는 영역을 렌더링한다.
 * 점선 테두리와 반투명 배경을 가지며, NodeResizer로 크기 조절이 가능하다.
 * 상단 라벨은 더블클릭으로 인라인 편집할 수 있다.
 *
 * @param props.id       React Flow 노드 ID
 * @param props.data     그룹 데이터 (label, color)
 * @param props.selected 선택 상태
 */
function GroupNode({ id, data, selected }: NodeProps<GroupNodeType>) {
  const { t } = useTranslation();
  const renameGroup = useCanvasStore((s) => s.renameGroup);
  const resizeGroup = useCanvasStore((s) => s.resizeGroup);
  const { canEdit } = useErdPermission();

  /** 그룹 이름 변경 핸들러. @param value 새 그룹 이름 */
  const handleRename = (value: string) => renameGroup(id, value);

  const { editing, value, setValue, startEdit, confirmEdit, cancelEdit } =
    useInlineEdit(handleRename);

  const colorConfig = TABLE_COLORS[data.color ?? 'default'];

  return (
    <div
      className="relative rounded-lg border-2 border-dashed min-w-[200px] min-h-[150px] w-full h-full"
      style={{
        borderColor: `hsl(${colorConfig.bg} / 0.5)`,
        backgroundColor: `hsl(${colorConfig.bg} / 0.08)`,
      }}
      role="group"
      aria-label={t('erd.groupNode.aria.group', { name: data.label })}
    >
      <NodeResizer
        isVisible={canEdit && !!selected}
        minWidth={200}
        minHeight={150}
        lineClassName="!border-primary/50"
        handleClassName="!w-2.5 !h-2.5 !bg-primary !border-primary"
        onResize={(_, params) => resizeGroup(id, params.width, params.height)}
      />

      {/* 그룹 라벨 — 상단 테두리에 겹치는 형태 */}
      <div className="absolute top-0 left-3 -translate-y-1/2">
        {editing && canEdit ? (
          <input
            className="nodrag px-2 py-0.5 bg-background text-xs font-medium rounded border border-border outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[60px]"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={confirmEdit}
            onKeyDown={(e) => {
              if (e.key === KEYS.ENTER) confirmEdit();
              if (e.key === KEYS.ESCAPE) cancelEdit();
            }}
            autoFocus
            aria-label={t('erd.groupNode.aria.groupName')}
          />
        ) : (
          <span
            className="px-2 py-0.5 bg-background text-xs font-medium rounded cursor-pointer select-none"
            style={{ color: `hsl(${colorConfig.bg})` }}
            onDoubleClick={canEdit ? () => startEdit(data.label) : undefined}
          >
            {data.label}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(GroupNode);
