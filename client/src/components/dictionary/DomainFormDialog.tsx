import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Domain, DomainFormData } from '@/types/dictionary';

function requiresDataLength(dataType: string): boolean {
  const normalizedType = dataType.trim().toUpperCase();
  return ['VARCHAR', 'CHAR', 'CHARACTER', 'DECIMAL', 'NUMERIC'].includes(normalizedType);
}

function isScaleInvalid(dataLength: string, dataScale: string): boolean {
  const normalizedLength = dataLength.trim();
  const normalizedScale = dataScale.trim();
  if (!normalizedScale) {
    return false;
  }
  if (!normalizedLength) {
    return true;
  }
  return Number(normalizedScale) > Number(normalizedLength);
}

function formatStandardDomainName(
  domainName: string,
  dataType: string,
  dataLength: string,
  dataScale: string,
): string {
  const normalizedDomainName = domainName.trim().replace(/\s+/g, '');
  const normalizedType = dataType.trim().toUpperCase();
  if (!normalizedDomainName || !normalizedType) {
    return '';
  }

  const normalizedLength = dataLength.trim();
  const normalizedScale = dataScale.trim();
  if (requiresDataLength(normalizedType) && !normalizedLength) {
    return '';
  }

  if (normalizedType === 'VARCHAR') {
    const suffix = `V${normalizedLength}`;
    if (normalizedDomainName.toUpperCase().endsWith(`_${suffix}`.toUpperCase())) {
      return normalizedDomainName;
    }
    return `${normalizedDomainName}_${suffix}`;
  }
  if (normalizedType === 'CHAR' || normalizedType === 'CHARACTER') {
    const suffix = `C${normalizedLength}`;
    if (normalizedDomainName.toUpperCase().endsWith(`_${suffix}`.toUpperCase())) {
      return normalizedDomainName;
    }
    return `${normalizedDomainName}_${suffix}`;
  }
  if (normalizedType !== 'DECIMAL' && normalizedType !== 'NUMERIC') {
    return normalizedDomainName;
  }

  let suffix = normalizedType;
  if (normalizedLength) {
    suffix += normalizedLength;
  }
  if (normalizedScale) {
    suffix += `_${normalizedScale}`;
  }
  const duplicateSuffix = `_${suffix}`.toUpperCase();
  if (normalizedDomainName.toUpperCase().endsWith(duplicateSuffix)) {
    return normalizedDomainName;
  }
  return `${normalizedDomainName}_${suffix}`;
}

function formatPhysicalType(dataType: string, dataLength: string, dataScale: string): string {
  const normalizedType = dataType.trim().toUpperCase();
  if (!normalizedType) {
    return '';
  }

  const normalizedLength = dataLength.trim();
  const normalizedScale = dataScale.trim();
  if (!normalizedLength) {
    return normalizedType;
  }
  if (!normalizedScale) {
    return `${normalizedType}(${normalizedLength})`;
  }
  return `${normalizedType}(${normalizedLength},${normalizedScale})`;
}

function inferDomainClassification(initialData: Domain | null | undefined): string {
  if (!initialData) {
    return '';
  }
  if (initialData.domainClassification?.trim()) {
    return initialData.domainClassification;
  }

  const logicalName = initialData.logicalName?.trim();
  if (!logicalName) {
    return '';
  }

  const normalizedType = initialData.dataType?.trim().toUpperCase() ?? '';
  let suffix = '';
  if (normalizedType === 'VARCHAR' && initialData.dataLength != null) {
    suffix = `_V${initialData.dataLength}`;
  } else if (
    (normalizedType === 'CHAR' || normalizedType === 'CHARACTER') &&
    initialData.dataLength != null
  ) {
    suffix = `_C${initialData.dataLength}`;
  } else if (
    (normalizedType === 'DECIMAL' || normalizedType === 'NUMERIC') &&
    initialData.dataLength != null
  ) {
    suffix = `_${normalizedType}${initialData.dataLength}${
      initialData.dataScale != null ? `_${initialData.dataScale}` : ''
    }`;
  }

  if (
    suffix &&
    logicalName.length > suffix.length &&
    logicalName.toUpperCase().endsWith(suffix.toUpperCase())
  ) {
    return logicalName.slice(0, -suffix.length);
  }
  return logicalName;
}

/** DomainFormDialog 컴포넌트 props */
interface DomainFormDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 폼 제출 핸들러 */
  onSubmit: (data: DomainFormData) => Promise<void>;
  /** 수정 대상 도메인 (없으면 생성 모드) */
  initialData?: Domain | null;
}

/**
 * 도메인 생성/수정 다이얼로그.
 *
 * initialData가 있으면 수정 모드, 없으면 생성 모드로 동작한다.
 */
export default function DomainFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: DomainFormDialogProps) {
  const { t } = useTranslation();

  /** 도메인 그룹 입력값 */
  const [domainGroup, setDomainGroup] = useState('');
  /** 도메인명 입력값 */
  const [domainClassification, setDomainClassification] = useState('');
  /** 데이터 타입 입력값 */
  const [dataType, setDataType] = useState('');
  /** 데이터 길이 입력값 */
  const [dataLength, setDataLength] = useState('');
  /** 데이터 소수점 길이 입력값 */
  const [dataScale, setDataScale] = useState('');
  /** 설명 입력값 */
  const [description, setDescription] = useState('');
  /** 제출 중 여부 */
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initialData;

  useEffect(() => {
    if (open) {
      setDomainGroup(initialData?.domainGroup ?? '');
      setDomainClassification(inferDomainClassification(initialData));
      setDataType(initialData?.dataType ?? '');
      setDataLength(initialData?.dataLength != null ? String(initialData.dataLength) : '');
      setDataScale(initialData?.dataScale != null ? String(initialData.dataScale) : '');
      setDescription(initialData?.description ?? '');
    }
  }, [open, initialData]);

  /**
   * 폼 제출 핸들러.
   *
   * @param e 폼 이벤트
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const standardLogicalName = formatStandardDomainName(
        domainClassification,
        dataType,
        dataLength,
        dataScale,
      );
      await onSubmit({
        logicalName: standardLogicalName,
        domainGroup: domainGroup.trim() || undefined,
        domainClassification: domainClassification.trim() || undefined,
        dataType: dataType.trim().toUpperCase(),
        dataLength: dataLength.trim() ? Number(dataLength.trim()) : undefined,
        dataScale: dataScale.trim() ? Number(dataScale.trim()) : undefined,
        description: description.trim() || undefined,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const standardLogicalName = formatStandardDomainName(
    domainClassification,
    dataType,
    dataLength,
    dataScale,
  );
  const physicalTypePreview = formatPhysicalType(dataType, dataLength, dataScale);
  const lengthRequired = requiresDataLength(dataType);
  const hasInvalidScale = isScaleInvalid(dataLength, dataScale);
  const canSubmit =
    !submitting &&
    !!domainClassification.trim() &&
    !!dataType.trim() &&
    (!lengthRequired || !!dataLength.trim()) &&
    !hasInvalidScale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('dictionary.domain.form.editTitle')
              : t('dictionary.domain.form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('dictionary.domain.form.editDescription')
              : t('dictionary.domain.form.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="domain-group">{t('dictionary.domain.form.domainGroup')}</Label>
              <Input
                id="domain-group"
                value={domainGroup}
                onChange={(e) => setDomainGroup(e.target.value)}
                placeholder={t('dictionary.domain.form.domainGroupPlaceholder')}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-classification">
                {t('dictionary.domain.form.domainClassification')}
              </Label>
              <Input
                id="domain-classification"
                value={domainClassification}
                onChange={(e) => setDomainClassification(e.target.value)}
                placeholder={t('dictionary.domain.form.domainClassificationPlaceholder')}
                required
                maxLength={100}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain-logicalName">{t('dictionary.domain.form.logicalName')}</Label>
            <Input
              id="domain-logicalName"
              value={standardLogicalName}
              readOnly
              placeholder={t('dictionary.domain.form.logicalNamePlaceholder')}
              maxLength={100}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="domain-dataType">{t('dictionary.domain.form.dataType')}</Label>
              <Input
                id="domain-dataType"
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
                placeholder={t('dictionary.domain.form.dataTypePlaceholder')}
                required
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-dataLength">{t('dictionary.domain.form.dataLength')}</Label>
              <Input
                id="domain-dataLength"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={dataLength}
                onChange={(e) => setDataLength(e.target.value)}
                placeholder={t('dictionary.domain.form.dataLengthPlaceholder')}
                required={lengthRequired}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-dataScale">{t('dictionary.domain.form.dataScale')}</Label>
              <Input
                id="domain-dataScale"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={dataScale}
                onChange={(e) => setDataScale(e.target.value)}
                placeholder={t('dictionary.domain.form.dataScalePlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain-physicalType">
              {t('dictionary.domain.form.physicalTypePreview')}
            </Label>
            <Input
              id="domain-physicalType"
              value={physicalTypePreview}
              readOnly
              placeholder={t('dictionary.domain.form.physicalTypePreviewPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain-description">{t('dictionary.domain.form.description')}</Label>
            <Input
              id="domain-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dictionary.domain.form.descriptionPlaceholder')}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting
                ? t('common.button.processing')
                : isEdit
                  ? t('common.button.save')
                  : t('common.button.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
