import { createContext, useContext, useMemo } from 'react';

/** ERD 편집 권한 컨텍스트 값 */
interface ErdPermissionContextValue {
  /** 편집 가능 여부 (ADMIN 또는 MEMBER) */
  canEdit: boolean;
}

const ErdPermissionContext = createContext<ErdPermissionContextValue | null>(null);

/** ErdPermissionProvider 컴포넌트 props */
interface ErdPermissionProviderProps {
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 자식 요소 */
  children: React.ReactNode;
}

/**
 * ERD 에디터용 권한 Provider.
 *
 * DiagramPage 레벨에서 canEdit을 설정하고,
 * 하위 ERD 컴포넌트(TableNode 등)에서 Context를 통해 소비한다.
 *
 * @param props.canEdit  편집 가능 여부
 * @param props.children 자식 요소
 */
export function ErdPermissionProvider({ canEdit, children }: ErdPermissionProviderProps) {
  /** canEdit이 같으면 같은 참조를 유지해 모든 구독자(TableNode 등)의 불필요한 리렌더링을 막는다 */
  const value = useMemo(() => ({ canEdit }), [canEdit]);
  return <ErdPermissionContext.Provider value={value}>{children}</ErdPermissionContext.Provider>;
}

/**
 * ERD 권한 컨텍스트를 소비하는 훅.
 *
 * ErdPermissionProvider 내부에서만 사용 가능하다.
 *
 * @returns { canEdit }
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useErdPermission(): ErdPermissionContextValue {
  const ctx = useContext(ErdPermissionContext);
  if (!ctx) {
    throw new Error('useErdPermission must be used within ErdPermissionProvider');
  }
  return ctx;
}
