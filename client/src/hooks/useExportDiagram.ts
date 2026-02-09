import { toPng, toJpeg, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

/** fitView 패딩 비율 */
const PADDING = 0.15;
/** 최소 줌 레벨 */
const MIN_ZOOM = 0.5;
/** 최대 줌 레벨 */
const MAX_ZOOM = 2;
/** 노드 바운드 주변 여백 (px) */
const BOUND_PADDING = 50;

/** 캡처 옵션 (뷰포트 요소 + 이미지 크기 + CSS transform) */
interface CaptureOptions {
  /** .react-flow__viewport DOM 요소 */
  viewportEl: HTMLElement;
  /** 이미지 너비 */
  imageWidth: number;
  /** 이미지 높이 */
  imageHeight: number;
  /** 뷰포트 transform 스타일 */
  style: {
    width: string;
    height: string;
    transform: string;
  };
}

/**
 * 다이어그램 Export 훅.
 *
 * React Flow의 노드 바운드를 계산하여 PNG/JPG/SVG/PDF로 내보낸다.
 * 현재 줌/팬 상태와 무관하게 모든 노드를 포함하는 이미지를 생성한다.
 *
 * @param diagramName 파일명에 사용할 다이어그램 이름
 * @returns export 함수 4종 (exportPng, exportJpg, exportSvg, exportPdf)
 */
export function useExportDiagram(diagramName: string) {
  const { t } = useTranslation();
  const { getNodes } = useReactFlow();

  /**
   * 공통 캡처 옵션을 계산한다.
   *
   * 모든 노드의 바운드에 맞는 이미지 크기와 CSS transform을 반환한다.
   * 노드가 없거나 뷰포트 요소가 없으면 null을 반환한다.
   *
   * @returns 캡처 옵션 또는 null
   */
  const getCaptureOptions = (): CaptureOptions | null => {
    const nodes = getNodes();
    if (nodes.length === 0) {
      toast.error(t('erd.export.noNodes'));
      return null;
    }

    const nodesBounds = getNodesBounds(nodes);
    const imageWidth = Math.ceil(nodesBounds.width + BOUND_PADDING * 2);
    const imageHeight = Math.ceil(nodesBounds.height + BOUND_PADDING * 2);
    const viewport = getViewportForBounds(
      nodesBounds,
      imageWidth,
      imageHeight,
      MIN_ZOOM,
      MAX_ZOOM,
      PADDING,
    );

    const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
    if (!viewportEl) return null;

    return {
      viewportEl,
      imageWidth,
      imageHeight,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    };
  };

  /**
   * Data URL 또는 Blob URL을 파일로 다운로드한다.
   *
   * @param url 다운로드할 URL
   * @param filename 파일명
   */
  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  /** PNG 포맷으로 다이어그램을 내보낸다. */
  const exportPng = async () => {
    try {
      const opts = getCaptureOptions();
      if (!opts) return;

      const dataUrl = await toPng(opts.viewportEl, {
        width: opts.imageWidth,
        height: opts.imageHeight,
        style: opts.style,
        backgroundColor: '#ffffff',
      });
      downloadFile(dataUrl, `${diagramName}.png`);
      toast.success(t('erd.export.success'));
    } catch {
      toast.error(t('erd.export.failed'));
    }
  };

  /** JPG 포맷으로 다이어그램을 내보낸다. */
  const exportJpg = async () => {
    try {
      const opts = getCaptureOptions();
      if (!opts) return;

      const dataUrl = await toJpeg(opts.viewportEl, {
        width: opts.imageWidth,
        height: opts.imageHeight,
        style: opts.style,
        backgroundColor: '#ffffff',
        quality: 0.95,
      });
      downloadFile(dataUrl, `${diagramName}.jpg`);
      toast.success(t('erd.export.success'));
    } catch {
      toast.error(t('erd.export.failed'));
    }
  };

  /** SVG 포맷으로 다이어그램을 내보낸다. */
  const exportSvg = async () => {
    try {
      const opts = getCaptureOptions();
      if (!opts) return;

      const dataUrl = await toSvg(opts.viewportEl, {
        width: opts.imageWidth,
        height: opts.imageHeight,
        style: opts.style,
        backgroundColor: '#ffffff',
      });
      downloadFile(dataUrl, `${diagramName}.svg`);
      toast.success(t('erd.export.success'));
    } catch {
      toast.error(t('erd.export.failed'));
    }
  };

  /** PDF 포맷으로 다이어그램을 내보낸다. PNG로 캡처 후 jsPDF로 변환한다. */
  const exportPdf = async () => {
    try {
      const opts = getCaptureOptions();
      if (!opts) return;

      const dataUrl = await toPng(opts.viewportEl, {
        width: opts.imageWidth,
        height: opts.imageHeight,
        style: opts.style,
        backgroundColor: '#ffffff',
      });

      const orientation = opts.imageWidth > opts.imageHeight ? 'landscape' : 'portrait';
      const doc = new jsPDF({
        orientation,
        unit: 'px',
        format: [opts.imageWidth, opts.imageHeight],
      });
      doc.addImage(dataUrl, 'PNG', 0, 0, opts.imageWidth, opts.imageHeight);
      doc.save(`${diagramName}.pdf`);
      toast.success(t('erd.export.success'));
    } catch {
      toast.error(t('erd.export.failed'));
    }
  };

  return { exportPng, exportJpg, exportSvg, exportPdf };
}
