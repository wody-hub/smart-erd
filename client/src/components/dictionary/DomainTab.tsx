import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Database, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Spinner from '@/components/ui/spinner';
import DomainFormDialog from '@/components/dictionary/DomainFormDialog';
import BulkUploadDialog from '@/components/dictionary/BulkUploadDialog';
import {
  fetchDomains,
  createDomain,
  updateDomain,
  deleteDomain,
  downloadDomainTemplate,
} from '@/api/domainApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type { Domain, DomainFormData } from '@/types/dictionary';

/** DomainTab 컴포넌트의 props. */
interface DomainTabProps {
  /** 편집 가능 여부 (VIEWER일 때 false — 생성/수정/삭제/업로드 버튼 숨김) */
  canEdit?: boolean;
  /** 선택된 사전 세트 ID */
  setId: string;
}

/**
 * 도메인 사전 탭 컴포넌트.
 *
 * 도메인 목록 테이블과 생성/수정/삭제 기능을 제공한다.
 * 역할에 따라 CRUD/업로드 버튼을 조건부 렌더링한다.
 *
 * @param props.canEdit 편집 가능 여부
 */
export default function DomainTab({ canEdit = true, setId }: DomainTabProps) {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  /** 폼 다이얼로그 열림 상태 */
  const [formOpen, setFormOpen] = useState(false);
  /** 수정 대상 도메인 (null이면 생성 모드) */
  const [editTarget, setEditTarget] = useState<Domain | null>(null);
  /** 삭제 확인 대상 도메인 ID */
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  /** 일괄 업로드 다이얼로그 열림 상태 */
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: domains = [], isLoading } = useQuery({
    queryKey: queryKeys.dictionary.domains(teamId!, setId),
    queryFn: () => fetchDomains(teamId!, setId),
    enabled: !!teamId && !!setId,
  });

  const createMutation = useMutation({
    mutationFn: (data: DomainFormData) => createDomain(teamId!, setId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.domains(teamId!, setId) });
      toast.success(t('dictionary.domain.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.domain.toast.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DomainFormData }) =>
      updateDomain(teamId!, setId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.domains(teamId!, setId) });
      toast.success(t('dictionary.domain.toast.updated'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.domain.toast.updateFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (domainId: number) => deleteDomain(teamId!, setId, domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.domains(teamId!, setId) });
      setDeleteTarget(null);
      toast.success(t('dictionary.domain.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.domain.toast.deleteFailed'))),
  });

  const downloadTemplateMutation = useMutation({
    mutationFn: () => downloadDomainTemplate(teamId!, setId),
    onError: (err) =>
      toast.error(getErrorMessage(err, t('dictionary.upload.toast.templateFailed'))),
  });

  /**
   * 생성 버튼 클릭 핸들러.
   */
  const handleCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  /**
   * 수정 버튼 클릭 핸들러.
   *
   * @param domain 수정 대상 도메인
   */
  const handleEdit = (domain: Domain) => {
    setEditTarget(domain);
    setFormOpen(true);
  };

  /**
   * 폼 제출 핸들러 (생성/수정 분기).
   *
   * @param data 폼 데이터
   */
  const handleSubmit = async (data: DomainFormData) => {
    if (editTarget) {
      await updateMutation.mutateAsync({ id: editTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  /**
   * 도메인 업로드 템플릿 다운로드 핸들러.
   */
  const handleTemplateDownload = () => {
    downloadTemplateMutation.mutate();
  };

  if (isLoading) {
    return <Spinner text={t('common.loading')} />;
  }

  return (
    <div>
      {canEdit && (
        <div className="flex justify-end gap-2 mb-4">
          <Button
            variant="outline"
            onClick={handleTemplateDownload}
            disabled={downloadTemplateMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {t('dictionary.upload.template')}
          </Button>
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {t('dictionary.upload.button')}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('dictionary.domain.form.createTitle')}
          </Button>
        </div>
      )}

      {domains.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{t('dictionary.domain.table.empty')}</p>
            {canEdit && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {t('dictionary.domain.form.createTitle')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('dictionary.domain.table.logicalName')}</TableHead>
              <TableHead>{t('dictionary.domain.table.physicalType')}</TableHead>
              <TableHead>{t('dictionary.domain.table.description')}</TableHead>
              {canEdit && (
                <TableHead className="w-[100px]">{t('dictionary.domain.table.actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.map((domain) => (
              <TableRow key={domain.id}>
                <TableCell className="font-medium">{domain.logicalName}</TableCell>
                <TableCell className="font-mono">{domain.physicalType}</TableCell>
                <TableCell className="text-muted-foreground">{domain.description ?? ''}</TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(domain)}
                        aria-label={t('dictionary.domain.aria.editDomain', {
                          name: domain.logicalName,
                        })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteTarget(domain.id)}
                        aria-label={t('dictionary.domain.aria.deleteDomain', {
                          name: domain.logicalName,
                        })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DomainFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        initialData={editTarget}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('dictionary.domain.delete.dialogTitle')}
        description={t('dictionary.domain.delete.dialogDescription')}
        onConfirm={() => {
          if (deleteTarget !== null) deleteMutation.mutate(deleteTarget);
        }}
        loading={deleteMutation.isPending}
      />

      <BulkUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        mode="domain"
        setId={setId}
      />
    </div>
  );
}
