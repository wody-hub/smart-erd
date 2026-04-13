import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FilePenLine,
  FileText,
  LayoutTemplate,
  Network,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MARKDOWN_TEMPLATE_OPTIONS } from '@/lib/markdown-templates';
import { cn } from '@/lib/utils';
import type { DictionarySet } from '@/types/dictionary';
import type { CreateProjectDocumentInput, DocumentPluginId } from '@/types/document';
import type { MarkdownTemplateKey } from '@/types/markdown';

/** 프로젝트 문서 생성 다이얼로그 props. */
interface CreateDocumentDialogProps {
  /** 다이얼로그 오픈 여부 */
  open: boolean;
  /** 오픈 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 선택 가능한 사전 컨텍스트 목록 */
  dictionarySets: DictionarySet[];
  /** 문서 생성 제출 핸들러 */
  onCreate: (input: CreateProjectDocumentInput) => Promise<unknown>;
}

const DOCUMENT_TYPE_OPTIONS: Array<{
  pluginId: DocumentPluginId;
  icon: typeof Network;
  titleKey:
    | 'workspace.documentType.erd'
    | 'workspace.documentType.markdown'
    | 'workspace.documentType.screenSpec';
  descriptionKey:
    | 'workspace.createDocument.erdDescription'
    | 'workspace.createDocument.markdownDescription'
    | 'workspace.createDocument.screenSpecDescription';
}> = [
  {
    pluginId: 'erd',
    icon: Network,
    titleKey: 'workspace.documentType.erd',
    descriptionKey: 'workspace.createDocument.erdDescription',
  },
  {
    pluginId: 'markdown',
    icon: FilePenLine,
    titleKey: 'workspace.documentType.markdown',
    descriptionKey: 'workspace.createDocument.markdownDescription',
  },
  {
    pluginId: 'screen-spec',
    icon: LayoutTemplate,
    titleKey: 'workspace.documentType.screenSpec',
    descriptionKey: 'workspace.createDocument.screenSpecDescription',
  },
];

const DOCUMENT_PREVIEW_LINES = {
  erd: [
    'workspace.createDocument.previewErdLine1',
    'workspace.createDocument.previewErdLine2',
    'workspace.createDocument.previewErdLine3',
  ],
  markdown: [
    'workspace.createDocument.previewMarkdownLine1',
    'workspace.createDocument.previewMarkdownLine2',
    'workspace.createDocument.previewMarkdownLine3',
  ],
  'screen-spec': [
    'workspace.createDocument.previewScreenSpecLine1',
    'workspace.createDocument.previewScreenSpecLine2',
    'workspace.createDocument.previewScreenSpecLine3',
  ],
} as const;

/**
 * ERD/Markdown 문서 생성 2단계 다이얼로그를 렌더링한다.
 *
 * @param props 다이얼로그 props
 * @returns 문서 생성 다이얼로그 JSX
 */
export default function CreateDocumentDialog({
  open,
  onOpenChange,
  dictionarySets,
  onCreate,
}: CreateDocumentDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [pluginId, setPluginId] = useState<DocumentPluginId | null>(null);
  const [name, setName] = useState('');
  const [dictionarySetId, setDictionarySetId] = useState('');
  const [templateKey, setTemplateKey] = useState<MarkdownTemplateKey>('technical-spec');
  const [submitting, setSubmitting] = useState(false);

  const defaultDictionarySetId = useMemo(() => {
    const defaultSet = dictionarySets.find((set) => set.isDefault);
    return String(defaultSet?.id ?? dictionarySets[0]?.id ?? '');
  }, [dictionarySets]);
  const hasDictionaryContext = Boolean(defaultDictionarySetId);
  const selectedOption = pluginId
    ? (DOCUMENT_TYPE_OPTIONS.find((option) => option.pluginId === pluginId) ?? null)
    : null;
  const selectedTemplate =
    MARKDOWN_TEMPLATE_OPTIONS.find((template) => template.key === templateKey) ?? null;
  const previewLines = pluginId ? DOCUMENT_PREVIEW_LINES[pluginId] : [];
  const selectedDictionaryName =
    dictionarySets.find((set) => String(set.id) === (dictionarySetId || defaultDictionarySetId))
      ?.name ?? null;

  /**
   * 다이얼로그 open 상태 변경 시 내부 step/form 상태를 초기화한다.
   *
   * @param nextOpen 다음 open 상태
   * @returns 없음
   */
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep(1);
      setPluginId(null);
      setName('');
      setDictionarySetId('');
      setTemplateKey('technical-spec');
    }
    onOpenChange(nextOpen);
  };

  /**
   * 선택된 문서 타입 기준으로 2단계 설정 화면으로 이동한다.
   *
   * @returns 없음
   */
  const handleContinue = () => {
    if (!pluginId) {
      return;
    }
    if (pluginId === 'erd' && !hasDictionaryContext) {
      return;
    }
    if (pluginId === 'erd' && !dictionarySetId && defaultDictionarySetId) {
      setDictionarySetId(defaultDictionarySetId);
    }
    setStep(2);
  };

  /**
   * 현재 폼 입력으로 새 문서 생성을 제출한다.
   *
   * @param event 폼 submit 이벤트
   * @returns 없음
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pluginId || !name.trim()) {
      return;
    }
    const resolvedDictionarySetId = dictionarySetId || defaultDictionarySetId;
    if (pluginId === 'erd' && !resolvedDictionarySetId) {
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        pluginId,
        dictionarySetId: pluginId === 'erd' ? Number(resolvedDictionarySetId) : null,
        templateKey: pluginId === 'markdown' ? templateKey : null,
      });
      handleOpenChange(false);
    } catch {
      // 에러 toast는 onCreate(useMutation onError)에서 처리됨
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden rounded-[28px] border-border/90 bg-card p-0">
        <div className="surface-display surface-display--documents border-b border-border/70 px-6 pb-6 pt-7 sm:px-8">
          <DialogHeader className="pr-12">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="rounded-full border border-border/80 bg-card px-2.5 py-1 text-foreground">
                {t('workspace.createDocument.eyebrow')}
              </span>
              <span>
                {step === 1
                  ? t('workspace.createDocument.stepType')
                  : t('workspace.createDocument.stepSetup')}
              </span>
            </div>
            <DialogTitle className="pt-2">{t('workspace.action.newDocument')}</DialogTitle>
            <DialogDescription className="max-w-2xl">
              {step === 1
                ? t('workspace.createDocument.stepTypeDescription')
                : t('workspace.createDocument.stepSetupDescription')}
            </DialogDescription>
          </DialogHeader>
        </div>
        {step === 1 ? (
          <>
            <div className="bg-card px-6 py-6 sm:px-8">
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('workspace.createDocument.pluginSectionTitle')}
                </p>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  {t('workspace.createDocument.pluginSectionHint')}
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {DOCUMENT_TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = pluginId === option.pluginId;
                  const disabled = option.pluginId === 'erd' && !hasDictionaryContext;
                  return (
                    <button
                      key={option.pluginId}
                      type="button"
                      disabled={disabled}
                      className={cn(
                        'surface-operational relative flex min-h-[190px] items-start gap-4 rounded-3xl px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/20',
                        disabled &&
                          'cursor-not-allowed opacity-60 hover:translate-y-0 hover:border-border',
                        selected &&
                          'border-primary/35 bg-primary/8 shadow-editorial ring-1 ring-primary/18',
                      )}
                      onClick={() => {
                        if (disabled) {
                          return;
                        }
                        setPluginId(option.pluginId);
                      }}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1 space-y-2">
                        <span className="block text-base font-semibold tracking-[-0.02em] text-foreground">
                          {t(option.titleKey)}
                        </span>
                        <span className="block text-sm leading-6 text-muted-foreground">
                          {t(option.descriptionKey)}
                        </span>
                        {disabled && (
                          <span className="mt-2 flex items-center gap-2 text-sm font-medium text-brand-warm">
                            <AlertTriangle className="h-4 w-4" />
                            {t('workspace.createDocument.erdRequiresDictionary')}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t('workspace.createDocument.selected')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/70 bg-card px-6 py-4 sm:px-8">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                {t('common.button.cancel')}
              </Button>
              <Button
                type="button"
                disabled={!pluginId || (pluginId === 'erd' && !hasDictionaryContext)}
                onClick={handleContinue}
              >
                {t('common.button.next')}
              </Button>
            </div>
          </>
        ) : (
          <form className="bg-card" onSubmit={handleSubmit}>
            <div className="grid gap-6 bg-card px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_320px]">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="document-name">{t('workspace.createDocument.nameLabel')}</Label>
                  <Input
                    id="document-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('workspace.createDocument.namePlaceholder')}
                    autoFocus
                    className="h-12 rounded-xl text-base"
                  />
                  <p className="text-sm leading-6 text-ink-secondary">
                    {t('workspace.createDocument.nameHint')}
                  </p>
                </div>

                {pluginId === 'erd' ? (
                  <div className="space-y-3">
                    {hasDictionaryContext ? (
                      <>
                        <Label htmlFor="document-dictionary">
                          {t('diagram.list.selectDictionaryContext')}
                        </Label>
                        <Select
                          value={dictionarySetId || defaultDictionarySetId}
                          onValueChange={setDictionarySetId}
                        >
                          <SelectTrigger
                            id="document-dictionary"
                            className="h-12 w-full rounded-xl"
                          >
                            <SelectValue placeholder={t('diagram.list.selectDictionaryContext')} />
                          </SelectTrigger>
                          <SelectContent>
                            {dictionarySets.map((set) => (
                              <SelectItem key={set.id} value={String(set.id)}>
                                {set.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm leading-6 text-ink-secondary">
                          {t('workspace.createDocument.dictionaryHint')}
                        </p>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-brand-warm/25 bg-brand-warm/10 px-4 py-4 text-sm leading-6 text-brand-warm">
                        {t('workspace.createDocument.erdRequiresDictionary')}
                      </div>
                    )}
                  </div>
                ) : pluginId === 'markdown' ? (
                  <div className="space-y-3">
                    <div>
                      <Label>{t('workspace.createDocument.templateLabel')}</Label>
                      <p className="mt-2 text-sm leading-6 text-ink-secondary">
                        {t('workspace.createDocument.templateHint')}
                      </p>
                    </div>
                    <div className="grid gap-3">
                      {MARKDOWN_TEMPLATE_OPTIONS.map((template) => (
                        <button
                          key={template.key}
                          type="button"
                          className={cn(
                            'surface-operational relative rounded-3xl px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/20',
                            templateKey === template.key &&
                              'border-primary/35 bg-primary/8 shadow-editorial ring-1 ring-primary/18',
                          )}
                          onClick={() => setTemplateKey(template.key)}
                        >
                          {templateKey === template.key && (
                            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t('workspace.createDocument.selected')}
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-foreground">{template.label}</span>
                          </div>
                          <p className="mt-2 pr-20 text-sm leading-6 text-muted-foreground">
                            {template.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-4">
                    <Label>{t('screenSpec.canvas.title')}</Label>
                    <p className="text-sm leading-6 text-ink-secondary">
                      {t('workspace.createDocument.screenSpecSetupHint')}
                    </p>
                  </div>
                )}
              </div>

              <aside className="surface-display surface-display--documents rounded-3xl px-5 py-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('workspace.createDocument.previewTitle')}
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-foreground">
                  {selectedOption ? t(selectedOption.titleKey) : t('workspace.action.newDocument')}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  {pluginId === 'markdown'
                    ? selectedTemplate?.description
                    : pluginId === 'screen-spec'
                      ? t('workspace.createDocument.screenSpecDescription')
                      : t('workspace.createDocument.erdDescription')}
                </p>
                <div className="mt-5 space-y-3 rounded-2xl border border-border/75 bg-card px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {t('workspace.createDocument.previewNameLabel')}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {name.trim() || t('workspace.createDocument.previewPendingName')}
                      </p>
                    </div>
                    <span className="rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                      {selectedOption ? t(selectedOption.titleKey) : '—'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {pluginId === 'markdown'
                        ? t('workspace.createDocument.previewTemplateLabel')
                        : pluginId === 'screen-spec'
                          ? t('workspace.createDocument.previewCanvasLabel')
                          : t('workspace.createDocument.previewDictionaryLabel')}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {pluginId === 'markdown'
                        ? (selectedTemplate?.label ?? '—')
                        : pluginId === 'screen-spec'
                          ? t('workspace.createDocument.previewCanvasBlank')
                          : (selectedDictionaryName ?? '—')}
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {t('workspace.createDocument.includesTitle')}
                  </p>
                  <div className="mt-3 space-y-2">
                    {previewLines.map((lineKey) => (
                      <div
                        key={lineKey}
                        className="flex items-start gap-2 rounded-2xl border border-border/72 bg-card px-3 py-3 text-sm leading-6 text-ink-secondary"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{t(lineKey)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            <div className="flex items-center justify-between border-t border-border/70 bg-card px-6 py-4 sm:px-8">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                {t('common.button.previous')}
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting || !name.trim() || (pluginId === 'erd' && !hasDictionaryContext)
                }
              >
                {submitting ? t('common.button.creating') : t('common.button.create')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
