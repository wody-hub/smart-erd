import { lazy, Suspense } from 'react';
import Spinner from '@/components/ui/spinner';
import type { DiagramCodeProjectionRuntime } from '@/collaboration/channel/diagram/use-diagram-code-projection';

/** 내부 플래그에서만 투영 패널 코드와 훅을 로드한다. */
const DslLiveProjectionPanel = lazy(() => import('@/components/erd/DslLiveProjectionPanel'));

/** 투영 마운트 경계의 입력. */
interface DiagramLiveProjectionSlotProps {
  /** 허용 목록까지 해석한 내부 플래그. */
  enabled: boolean;
  /** 다이어그램 ID. */
  diagramId: string;
  /** 기존 읽기 런타임. */
  runtime: DiagramCodeProjectionRuntime;
}

/**
 * off 경로에서는 패널과 읽기 포트를 생성하지 않는 마운트 경계.
 * @param props 해석된 플래그와 런타임
 * @returns 활성일 때만 전용 패널
 */
export default function DiagramLiveProjectionSlot({
  enabled,
  diagramId,
  runtime,
}: DiagramLiveProjectionSlotProps) {
  if (!enabled) return null;
  return (
    <div className="h-full min-h-[20rem] w-full shrink-0 md:min-h-0 md:w-2/5">
      <Suspense fallback={<Spinner />}>
        <DslLiveProjectionPanel key={diagramId} diagramId={diagramId} runtime={runtime} />
      </Suspense>
    </div>
  );
}
