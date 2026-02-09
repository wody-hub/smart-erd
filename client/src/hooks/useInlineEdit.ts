import { useState, useCallback } from 'react';

/**
 * 인라인 텍스트 편집을 위한 공통 훅.
 *
 * @param onConfirm 편집 확정 시 호출되는 콜백 (트리밍된 값 전달)
 * @returns 편집 상태와 제어 함수들 (editing, value, setValue, startEdit, confirmEdit, cancelEdit)
 */
export function useInlineEdit(onConfirm: (value: string) => void) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const startEdit = useCallback((initialValue: string) => {
    setValue(initialValue);
    setEditing(true);
  }, []);

  const confirmEdit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
    setEditing(false);
  }, [value, onConfirm]);

  const cancelEdit = useCallback(() => setEditing(false), []);

  return { editing, value, setValue, startEdit, confirmEdit, cancelEdit };
}
