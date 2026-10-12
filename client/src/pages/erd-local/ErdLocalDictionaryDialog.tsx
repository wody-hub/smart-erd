import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Plus, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import DomainFormDialog from '@/components/dictionary/DomainFormDialog';
import WordFormDialog from '@/components/dictionary/WordFormDialog';
import { parseErdLocalDictionaryFile } from '@/lib/erd-local-dictionary-storage';
import { useErdLocalDictionary } from './useErdLocalDictionary';
import { ErdLocalTermDialog } from './ErdLocalTermDialog';
import type {
  Domain,
  DomainFormData,
  Term,
  TermFormData,
  Word,
  WordFormData,
} from '@/types/dictionary';

/** 사전 파일 저장 시 파일명. */
const ERD_LOCAL_DICTIONARY_FILE_NAME = 'erd-local-dictionary.json';

/** 사전 파일 입력 accept 속성값. */
const ERD_LOCAL_DICTIONARY_FILE_ACCEPT = '.json,application/json';

/** 삭제 대상 종류. */
type DeleteTargetKind = 'domain' | 'term' | 'word';

/** 삭제 확인 대상. */
interface DeleteTarget {
  /** 항목 종류 */
  kind: DeleteTargetKind;
  /** 항목 id */
  id: number;
  /** 확인 문구용 논리명 */
  logicalName: string;
}

/** ErdLocalDictionaryDialog 컴포넌트 props. */
interface ErdLocalDictionaryDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
}

/**
 * ERD 로컬 모드용 사전 관리 다이얼로그.
 *
 * `ErdLocalDictionaryProvider` 안에서 렌더링되며 `useErdLocalDictionary()`를
 * 직접 사용한다. 도메인/용어/단어 탭별 목록·추가/수정/삭제와
 * 사전 파일 저장/열기를 제공한다.
 *
 * @param props.open 열림 상태
 * @param props.onOpenChange 열림 상태 변경 핸들러
 * @returns 사전 관리 다이얼로그 JSX
 */
export function ErdLocalDictionaryDialog({ open, onOpenChange }: ErdLocalDictionaryDialogProps) {
  const { t } = useTranslation();
  const store = useErdLocalDictionary();

  /** 도메인 폼 열림 여부 */
  const [domainFormOpen, setDomainFormOpen] = useState(false);
  /** 수정 중인 도메인 (없으면 생성 모드) */
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  /** 용어 폼 열림 여부 */
  const [termFormOpen, setTermFormOpen] = useState(false);
  /** 수정 중인 용어 (없으면 생성 모드) */
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  /** 단어 폼 열림 여부 */
  const [wordFormOpen, setWordFormOpen] = useState(false);
  /** 수정 중인 단어 (없으면 생성 모드) */
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  /** 삭제 확인 대상 */
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  /** 숨겨진 사전 파일 입력 참조 */
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * 중복 논리명 실패를 토스트로 알리고 폼을 열어 둔다.
   *
   * 폼 다이얼로그는 `onSubmit`이 resolve돼야 닫히므로 reject로 유지한다.
   */
  const rejectDuplicate = (): Promise<never> => {
    toast.error(t('erdLocalDictionary.duplicateLogicalName'));
    return Promise.reject(new Error('duplicate-logical-name'));
  };

  /**
   * 도메인 폼 제출 — 생성/수정을 스토어에 반영한다.
   *
   * @param data 도메인 폼 데이터
   */
  const handleDomainSubmit = async (data: DomainFormData): Promise<void> => {
    const result =
      editingDomain != null ? store.updateDomain(editingDomain.id, data) : store.createDomain(data);
    if (result === null) {
      await rejectDuplicate();
    }
  };

  /**
   * 용어 폼 제출 — 생성/수정을 스토어에 반영한다.
   *
   * @param data 용어 폼 데이터
   */
  const handleTermSubmit = async (data: TermFormData): Promise<void> => {
    const result =
      editingTerm != null ? store.updateTerm(editingTerm.id, data) : store.createTerm(data);
    if (result === null) {
      await rejectDuplicate();
    }
  };

  /**
   * 단어 폼 제출 — 생성/수정을 스토어에 반영한다.
   *
   * @param data 단어 폼 데이터
   */
  const handleWordSubmit = async (data: WordFormData): Promise<void> => {
    const result =
      editingWord != null ? store.updateWord(editingWord.id, data) : store.createWord(data);
    if (result === null) {
      await rejectDuplicate();
    }
  };

  /**
   * 도메인 추가 버튼 클릭 시 생성 폼을 연다.
   */
  const handleCreateDomain = () => {
    setEditingDomain(null);
    setDomainFormOpen(true);
  };

  /**
   * 용어 추가 버튼 클릭 시 생성 폼을 연다.
   */
  const handleCreateTerm = () => {
    setEditingTerm(null);
    setTermFormOpen(true);
  };

  /**
   * 단어 추가 버튼 클릭 시 생성 폼을 연다.
   */
  const handleCreateWord = () => {
    setEditingWord(null);
    setWordFormOpen(true);
  };

  /**
   * 삭제 확인 — 종류별 스토어 삭제를 수행한다.
   *
   * 도메인 삭제 시 연결 해제된 용어가 있으면 안내 토스트를 띄운다.
   */
  const handleConfirmDelete = () => {
    if (deleteTarget === null) {
      return;
    }
    if (deleteTarget.kind === 'term') {
      store.deleteTerm(deleteTarget.id);
    } else if (deleteTarget.kind === 'word') {
      store.deleteWord(deleteTarget.id);
    } else {
      const unlinked = store.deleteDomain(deleteTarget.id);
      if (unlinked > 0) {
        toast.info(t('erdLocalDictionary.domainUnlinked'));
      }
    }
    setDeleteTarget(null);
  };

  /**
   * 사전 파일 저장 버튼 클릭 시 JSON 파일 다운로드를 실행한다.
   */
  const handleSaveFile = () => {
    const payload = JSON.stringify(
      {
        version: 1,
        domains: store.domains,
        terms: store.terms,
        words: store.words,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = ERD_LOCAL_DICTIONARY_FILE_NAME;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  /**
   * 사전 파일 열기 버튼 클릭 시 숨겨진 입력을 연다.
   */
  const handleOpenFileClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * 선택된 사전 파일을 읽어 스토어를 통째로 교체한다.
   *
   * 파싱 실패 시 기존 사전을 유지하고 에러 토스트를 띄운다.
   *
   * @param event 파일 입력 변경 이벤트
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    void file.text().then((text) => {
      const parsed = parseErdLocalDictionaryFile(text);
      if (!parsed.ok) {
        toast.error(t('erdLocalDictionary.importError'));
        return;
      }
      store.replaceAll(parsed.data);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{t('erdLocalDictionary.title')}</DialogTitle>
            <DialogDescription>{t('erdLocalDictionary.manage')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveFile}>
              <Download className="mr-1 h-4 w-4" />
              {t('erdLocalDictionary.saveFile')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenFileClick}>
              <Upload className="mr-1 h-4 w-4" />
              {t('erdLocalDictionary.openFile')}
            </Button>
          </div>
          <Tabs defaultValue="domains">
            <TabsList>
              <TabsTrigger value="domains">{t('erdLocalDictionary.domains')}</TabsTrigger>
              <TabsTrigger value="terms">{t('erdLocalDictionary.terms')}</TabsTrigger>
              <TabsTrigger value="words">{t('erdLocalDictionary.words')}</TabsTrigger>
            </TabsList>
            <TabsContent value="domains">
              <div className="flex justify-end">
                <Button size="sm" onClick={handleCreateDomain}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t('erdLocalDictionary.create')}
                </Button>
              </div>
              {store.domains.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('erdLocalDictionary.empty')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('dictionary.domain.table.logicalName')}</TableHead>
                        <TableHead>{t('dictionary.domain.table.physicalType')}</TableHead>
                        <TableHead>{t('dictionary.domain.table.description')}</TableHead>
                        <TableHead className="w-[120px]">
                          {t('dictionary.domain.table.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {store.domains.map((domain) => (
                        <TableRow key={domain.id}>
                          <TableCell>{domain.logicalName}</TableCell>
                          <TableCell>{domain.physicalType}</TableCell>
                          <TableCell>{domain.description ?? ''}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingDomain(domain);
                                  setDomainFormOpen(true);
                                }}
                              >
                                {t('erdLocalDictionary.edit')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: 'domain',
                                    id: domain.id,
                                    logicalName: domain.logicalName,
                                  })
                                }
                              >
                                {t('erdLocalDictionary.delete')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            <TabsContent value="terms">
              <div className="flex justify-end">
                <Button size="sm" onClick={handleCreateTerm}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t('erdLocalDictionary.create')}
                </Button>
              </div>
              {store.terms.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('erdLocalDictionary.empty')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('dictionary.term.table.logicalName')}</TableHead>
                        <TableHead>{t('dictionary.term.table.physicalName')}</TableHead>
                        <TableHead>{t('dictionary.term.table.domain')}</TableHead>
                        <TableHead>{t('dictionary.term.table.description')}</TableHead>
                        <TableHead className="w-[120px]">
                          {t('dictionary.term.table.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {store.terms.map((term) => (
                        <TableRow key={term.id}>
                          <TableCell>{term.logicalName}</TableCell>
                          <TableCell>{term.physicalName}</TableCell>
                          <TableCell>
                            {term.domainLogicalName ?? t('dictionary.term.table.noDomain')}
                          </TableCell>
                          <TableCell>{term.description ?? ''}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingTerm(term);
                                  setTermFormOpen(true);
                                }}
                              >
                                {t('erdLocalDictionary.edit')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: 'term',
                                    id: term.id,
                                    logicalName: term.logicalName,
                                  })
                                }
                              >
                                {t('erdLocalDictionary.delete')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            <TabsContent value="words">
              <div className="flex justify-end">
                <Button size="sm" onClick={handleCreateWord}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t('erdLocalDictionary.create')}
                </Button>
              </div>
              {store.words.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('erdLocalDictionary.empty')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('dictionary.word.table.logicalName')}</TableHead>
                        <TableHead>{t('dictionary.word.table.physicalName')}</TableHead>
                        <TableHead>{t('dictionary.word.table.description')}</TableHead>
                        <TableHead className="w-[120px]">
                          {t('dictionary.word.table.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {store.words.map((word) => (
                        <TableRow key={word.id}>
                          <TableCell>{word.logicalName}</TableCell>
                          <TableCell>{word.physicalName}</TableCell>
                          <TableCell>{word.description ?? ''}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingWord(word);
                                  setWordFormOpen(true);
                                }}
                              >
                                {t('erdLocalDictionary.edit')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: 'word',
                                    id: word.id,
                                    logicalName: word.logicalName,
                                  })
                                }
                              >
                                {t('erdLocalDictionary.delete')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
          <input
            ref={fileInputRef}
            type="file"
            accept={ERD_LOCAL_DICTIONARY_FILE_ACCEPT}
            className="hidden"
            aria-label={t('erdLocalDictionary.openFile')}
            onChange={handleFileChange}
          />
        </DialogContent>
      </Dialog>

      <DomainFormDialog
        open={domainFormOpen}
        onOpenChange={setDomainFormOpen}
        onSubmit={handleDomainSubmit}
        initialData={editingDomain}
      />
      <ErdLocalTermDialog
        open={termFormOpen}
        onOpenChange={setTermFormOpen}
        onSubmit={handleTermSubmit}
        initialData={editingTerm}
        domains={store.domains}
        words={store.words}
      />
      <WordFormDialog
        open={wordFormOpen}
        onOpenChange={setWordFormOpen}
        onSubmit={handleWordSubmit}
        initialData={editingWord}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
        title={t('erdLocalDictionary.deleteTitle')}
        description={t('erdLocalDictionary.deleteDescription')}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
