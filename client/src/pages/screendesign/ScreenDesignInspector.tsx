import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  BringToFront,
  Layers,
  MousePointer2,
  SendToBack,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ScreenDesignFramePreset } from './screen-design-frame-presets';
import type {
  ScreenDesignInstance,
  ScreenDesignLibraryItem,
  ScreenDesignScreen,
} from './screen-design-document';
import {
  resolveScreenDesignInstanceLabel,
  resolveScreenDesignLibraryItemLabel,
  resolveScreenDesignMasterDefaultLabel,
} from './screen-design-labels';
import type { UpdateInstanceParams } from './use-screen-design-document';
import type { ScreenDesignViewportState } from './use-screen-design-viewport';
import {
  SCREEN_DESIGN_INSTANCE_MIN_HEIGHT,
  SCREEN_DESIGN_INSTANCE_MIN_WIDTH,
} from '@/constants/screen-design';

interface ScreenDesignInspectorProps {
  selectedScreen: ScreenDesignScreen | null;
  activeFramePreset: ScreenDesignFramePreset;
  collaborationConnected: boolean;
  selectedInstance: ScreenDesignInstance | null;
  viewport: ScreenDesignViewportState;
  rebindMasterId: string;
  rebindCandidates: ScreenDesignLibraryItem[];
  defaultAccentColor: string;
  onRebindMasterIdChange: (value: string) => void;
  onRenameScreen: (name: string) => boolean;
  updateInstance: (instanceId: string, updates: UpdateInstanceParams) => void;
  deleteInstance: (instanceId: string) => void;
  moveInstanceLayer: (
    screenId: string,
    instanceId: string,
    direction: 'forward' | 'backward' | 'front' | 'back',
  ) => void;
  clearSelection: () => void;
}

/**
 * 현재 화면과 선택 인스턴스 속성을 편집하는 inspector pane을 렌더링한다.
 *
 * @returns 우측 inspector pane JSX
 */
export default function ScreenDesignInspector({
  selectedScreen,
  activeFramePreset,
  collaborationConnected,
  selectedInstance,
  viewport,
  rebindMasterId,
  rebindCandidates,
  defaultAccentColor,
  onRebindMasterIdChange,
  onRenameScreen,
  updateInstance,
  deleteInstance,
  moveInstanceLayer,
  clearSelection,
}: ScreenDesignInspectorProps) {
  const { t } = useTranslation();
  const [screenNameDraft, setScreenNameDraft] = useState(selectedScreen?.name ?? '');
  const [instanceLabelDraft, setInstanceLabelDraft] = useState(
    selectedInstance?.overrideState.label ? selectedInstance.label : '',
  );
  const skipScreenNameBlurCommitRef = useRef(false);
  const skipInstanceLabelBlurCommitRef = useRef(false);
  const resetLabelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setScreenNameDraft(selectedScreen?.name ?? '');
  }, [selectedScreen?.id, selectedScreen?.name]);

  useEffect(() => {
    setInstanceLabelDraft(selectedInstance?.overrideState.label ? selectedInstance.label : '');
  }, [selectedInstance?.id, selectedInstance?.label, selectedInstance?.overrideState.label]);

  const updateSelectedInstance = useCallback(
    (updates: UpdateInstanceParams): void => {
      if (!selectedInstance) {
        return;
      }
      updateInstance(selectedInstance.id, updates);
    },
    [selectedInstance, updateInstance],
  );
  const commitScreenNameDraft = useCallback((): void => {
    if (skipScreenNameBlurCommitRef.current) {
      skipScreenNameBlurCommitRef.current = false;
      return;
    }
    if (!selectedScreen) {
      return;
    }
    const normalizedName = screenNameDraft.trim();
    if (!normalizedName) {
      setScreenNameDraft(selectedScreen.name);
      return;
    }
    if (normalizedName !== selectedScreen.name) {
      const applied = onRenameScreen(normalizedName);
      if (!applied) {
        setScreenNameDraft(selectedScreen.name);
        return;
      }
    }
    if (normalizedName !== screenNameDraft) {
      setScreenNameDraft(normalizedName);
    }
  }, [onRenameScreen, screenNameDraft, selectedScreen]);
  const commitInstanceLabelDraft = useCallback(
    (nextFocusTarget?: EventTarget | null): void => {
      if (skipInstanceLabelBlurCommitRef.current) {
        skipInstanceLabelBlurCommitRef.current = false;
        return;
      }
      if (nextFocusTarget === resetLabelButtonRef.current) {
        return;
      }
      if (!selectedInstance) {
        return;
      }
      const normalizedLabel = instanceLabelDraft.trim();
      const nextLabel = normalizedLabel || null;
      const currentLabel = selectedInstance.overrideState.label ? selectedInstance.label : null;
      if (nextLabel !== currentLabel) {
        updateSelectedInstance({ label: nextLabel });
      }
      if ((nextLabel ?? '') !== instanceLabelDraft) {
        setInstanceLabelDraft(nextLabel ?? '');
      }
    },
    [instanceLabelDraft, selectedInstance, updateSelectedInstance],
  );
  const handleDraftInputKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLInputElement>,
      resetDraft: () => void,
      skipBlurCommitRef: { current: boolean },
    ): void => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        skipBlurCommitRef.current = true;
        resetDraft();
        event.currentTarget.blur();
      }
    },
    [],
  );
  /**
   * 선택 인스턴스의 레이어 순서를 변경한다.
   *
   * @param direction 레이어 이동 방향
   */
  const moveSelectedInstanceLayer = (
    direction: 'forward' | 'backward' | 'front' | 'back',
  ): void => {
    if (!selectedScreen || !selectedInstance) {
      return;
    }
    moveInstanceLayer(selectedScreen.id, selectedInstance.id, direction);
  };
  /** 선택된 인스턴스를 삭제하고 selection을 비운다. */
  const deleteSelectedInstance = (): void => {
    if (!selectedInstance) {
      return;
    }
    deleteInstance(selectedInstance.id);
    clearSelection();
  };
  /**
   * 선택 인스턴스의 크기를 최소값 이상으로 갱신한다.
   *
   * @param key 갱신할 dimension 필드
   * @param value input 문자열 값
   * @param minValue 허용 최소값
   */
  const updateSelectedInstanceDimension = (
    key: 'width' | 'height',
    value: string,
    minValue: number,
  ): void => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const nextValue = Math.max(minValue, parsed);
    updateSelectedInstance(key === 'width' ? { width: nextValue } : { height: nextValue });
  };
  /**
   * 선택 인스턴스의 위치를 숫자 입력값으로 갱신한다.
   *
   * @param key 갱신할 position 필드
   * @param value input 문자열 값
   */
  const updateSelectedInstancePosition = (key: 'x' | 'y', value: string): void => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    updateSelectedInstance(key === 'x' ? { x: parsed } : { y: parsed });
  };

  return (
    <div className="space-y-5">
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('screenSpec.inspector.title')}
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="screen-spec-screen-name">{t('screenSpec.inspector.screen')}</Label>
            <Input
              id="screen-spec-screen-name"
              data-testid="screen-spec-screen-name-input"
              aria-label={t('screenSpec.inspector.screen')}
              className="mt-2"
              value={screenNameDraft}
              onChange={(event) => setScreenNameDraft(event.target.value)}
              onBlur={commitScreenNameDraft}
              onKeyDown={(event) =>
                handleDraftInputKeyDown(
                  event,
                  () => setScreenNameDraft(selectedScreen?.name ?? ''),
                  skipScreenNameBlurCommitRef,
                )
              }
              placeholder={t('screenSpec.screenList.namePlaceholder')}
            />
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('screenSpec.inspector.frame')}</dt>
              <dd className="font-medium text-foreground">
                {t(`screenSpec.framePreset.${activeFramePreset.id}.label`)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('screenSpec.inspector.size')}</dt>
              <dd className="font-medium text-foreground">
                {selectedScreen ? `${selectedScreen.width} x ${selectedScreen.height}` : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('screenSpec.inspector.status')}</dt>
              <dd className="font-medium text-foreground">
                {collaborationConnected
                  ? t('screenSpec.status.ready')
                  : t('screenSpec.status.connecting')}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="border-t border-border/70 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('screenSpec.inspector.selection')}
        </p>
        {selectedInstance ? (
          <div className="space-y-3">
            {selectedInstance.isOrphan ? (
              <div className="rounded-md border border-composition-warning-border bg-composition-warning-bg px-3 py-3 text-sm text-composition-warning-foreground">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-erd-warning" />
                  <div className="min-w-0">
                    <p className="font-medium">{t('screenSpec.orphan.title')}</p>
                    <p className="mt-1 text-xs leading-5 text-composition-warning-muted">
                      {t('screenSpec.orphan.description')}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-md border border-border/70 bg-background/72 px-3 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                <span>{resolveScreenDesignInstanceLabel(t, selectedInstance)}</span>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('screenSpec.inspector.position')}</dt>
                  <dd className="font-medium text-foreground">
                    {Math.round(selectedInstance.x)}, {Math.round(selectedInstance.y)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('screenSpec.inspector.size')}</dt>
                  <dd className="font-medium text-foreground">
                    {Math.round(selectedInstance.width)} x {Math.round(selectedInstance.height)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t('screenSpec.inspector.masterDefault')}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {resolveScreenDesignMasterDefaultLabel(t, selectedInstance)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3 rounded-md border border-border/70 bg-background/72 px-3 py-3">
              <div>
                <Label htmlFor="screen-spec-instance-label">
                  {t('screenSpec.inspector.labelOverride')}
                </Label>
                <Input
                  id="screen-spec-instance-label"
                  data-testid="screen-spec-instance-label-input"
                  aria-label={t('screenSpec.inspector.labelOverride')}
                  className="mt-2"
                  value={instanceLabelDraft}
                  placeholder={resolveScreenDesignMasterDefaultLabel(t, selectedInstance)}
                  onChange={(event) => setInstanceLabelDraft(event.target.value)}
                  onBlur={(event) => commitInstanceLabelDraft(event.relatedTarget)}
                  onKeyDown={(event) =>
                    handleDraftInputKeyDown(
                      event,
                      () =>
                        setInstanceLabelDraft(
                          selectedInstance.overrideState.label ? selectedInstance.label : '',
                        ),
                      skipInstanceLabelBlurCommitRef,
                    )
                  }
                />
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {selectedInstance.overrideState.label
                      ? t('screenSpec.inspector.overrideStatus.overridden')
                      : t('screenSpec.inspector.overrideStatus.inherited')}
                  </span>
                  <Button
                    ref={resetLabelButtonRef}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      setInstanceLabelDraft('');
                      updateSelectedInstance({ label: null });
                    }}
                    disabled={!selectedInstance.overrideState.label}
                >
                    {t('screenSpec.inspector.resetLabel')}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="screen-spec-instance-accent">
                  {t('screenSpec.inspector.accentColor')}
                </Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    id="screen-spec-instance-accent"
                    aria-label={t('screenSpec.inspector.accentColor')}
                    type="color"
                    className="h-10 w-16 p-1"
                    value={
                      selectedInstance.accentColor ??
                      selectedInstance.masterAccentColor ??
                      defaultAccentColor
                    }
                    onChange={(event) =>
                      updateSelectedInstance({
                        accentColor: event.target.value,
                      })
                    }
                  />
                  <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {selectedInstance.overrideState.accentColor
                      ? t('screenSpec.inspector.overrideStatus.overridden')
                      : t('screenSpec.inspector.overrideStatus.inherited')}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => updateSelectedInstance({ accentColor: null })}
                    disabled={!selectedInstance.overrideState.accentColor}
                  >
                    {t('screenSpec.inspector.resetColor')}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  {selectedInstance.overrideState.width || selectedInstance.overrideState.height
                    ? t('screenSpec.inspector.overrideStatus.overridden')
                    : t('screenSpec.inspector.overrideStatus.inherited')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => updateSelectedInstance({ width: null, height: null })}
                  disabled={
                    !selectedInstance.overrideState.width && !selectedInstance.overrideState.height
                  }
                  >
                  {t('screenSpec.inspector.resetSize')}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="screen-spec-instance-x">X</Label>
                  <Input
                    id="screen-spec-instance-x"
                    data-testid="screen-spec-instance-x-input"
                    type="number"
                    className="mt-2"
                    value={Math.round(selectedInstance.x)}
                    onChange={(event) => updateSelectedInstancePosition('x', event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="screen-spec-instance-y">Y</Label>
                  <Input
                    id="screen-spec-instance-y"
                    data-testid="screen-spec-instance-y-input"
                    type="number"
                    className="mt-2"
                    value={Math.round(selectedInstance.y)}
                    onChange={(event) => updateSelectedInstancePosition('y', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="screen-spec-instance-width">
                    {t('screenSpec.inspector.width')}
                  </Label>
                  <Input
                    id="screen-spec-instance-width"
                    data-testid="screen-spec-instance-width-input"
                    type="number"
                    min={SCREEN_DESIGN_INSTANCE_MIN_WIDTH}
                    className="mt-2"
                    value={Math.round(selectedInstance.width)}
                    onChange={(event) =>
                      updateSelectedInstanceDimension(
                        'width',
                        event.target.value,
                        SCREEN_DESIGN_INSTANCE_MIN_WIDTH,
                      )
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="screen-spec-instance-height">
                    {t('screenSpec.inspector.height')}
                  </Label>
                  <Input
                    id="screen-spec-instance-height"
                    data-testid="screen-spec-instance-height-input"
                    type="number"
                    min={SCREEN_DESIGN_INSTANCE_MIN_HEIGHT}
                    className="mt-2"
                    value={Math.round(selectedInstance.height)}
                    onChange={(event) =>
                      updateSelectedInstanceDimension(
                        'height',
                        event.target.value,
                        SCREEN_DESIGN_INSTANCE_MIN_HEIGHT,
                      )
                    }
                  />
                </div>
              </div>
            </div>

            {selectedInstance.isOrphan ? (
              <div className="space-y-3 rounded-md border border-border/70 bg-background/72 px-3 py-3">
                <div>
                  <Label htmlFor="screen-spec-orphan-rebind">
                    {t('screenSpec.orphan.rebindLabel')}
                  </Label>
                  <Select value={rebindMasterId} onValueChange={onRebindMasterIdChange}>
                    <SelectTrigger
                      id="screen-spec-orphan-rebind"
                      className="mt-2"
                      aria-label={t('screenSpec.orphan.rebindLabel')}
                    >
                      <SelectValue placeholder={t('screenSpec.orphan.rebindPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {rebindCandidates.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {resolveScreenDesignLibraryItemLabel(t, item, item.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  disabled={!rebindMasterId}
                  onClick={() => {
                    if (!rebindMasterId) {
                      return;
                    }
                    updateSelectedInstance({ masterId: rebindMasterId });
                  }}
                >
                  {t('screenSpec.orphan.rebindAction')}
                </Button>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('screenSpec.inspector.layers')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => moveSelectedInstanceLayer('front')}
                >
                  <BringToFront className="mr-1 h-4 w-4" />
                  {t('screenSpec.inspector.bringToFront')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => moveSelectedInstanceLayer('back')}
                >
                  <SendToBack className="mr-1 h-4 w-4" />
                  {t('screenSpec.inspector.sendToBack')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => moveSelectedInstanceLayer('forward')}
                >
                  <Layers className="mr-1 h-4 w-4" />
                  {t('screenSpec.inspector.bringForward')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => moveSelectedInstanceLayer('backward')}
                >
                  <Layers className="mr-1 h-4 w-4" />
                  {t('screenSpec.inspector.sendBackward')}
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="justify-start text-destructive hover:text-destructive"
              onClick={deleteSelectedInstance}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {t('screenSpec.inspector.deleteSelection')}
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
            {t('screenSpec.inspector.selectionEmpty')}
          </div>
        )}
      </section>

      <section className="border-t border-border/70 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('screenSpec.inspector.view')}
        </p>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('screenSpec.inspector.zoom')}</dt>
            <dd className="font-medium text-foreground">{Math.round(viewport.zoom * 100)}%</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('screenSpec.inspector.offsetX')}</dt>
            <dd className="font-medium text-foreground">{Math.round(viewport.x)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('screenSpec.inspector.offsetY')}</dt>
            <dd className="font-medium text-foreground">{Math.round(viewport.y)}</dd>
          </div>
        </dl>
        <div className="mt-4 rounded-md border border-border/70 bg-background/72 px-3 py-3 text-xs text-muted-foreground">
          {t('screenSpec.inspector.keyboardHint')}
        </div>
      </section>
    </div>
  );
}
