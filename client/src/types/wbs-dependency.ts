/** WBS dependency relationship types. */
export type WbsDependencyType = 'FS' | 'SS' | 'FF' | 'SF';

/** Project WBS dependency response model. */
export interface WbsDependency {
  /** Dependency ID */
  id: number;
  /** Project ID */
  projectId: number;
  /** Predecessor WBS item ID */
  predecessorWbsItemId: number;
  /** Predecessor WBS item name */
  predecessorWbsItemName?: string | null;
  /** Successor WBS item ID */
  successorWbsItemId: number;
  /** Successor WBS item name */
  successorWbsItemName?: string | null;
  /** Dependency type */
  dependencyType: WbsDependencyType;
  /** Sort order */
  sortOrder: number;
  /** Created timestamp (UTC, ISO-8601) */
  createdAt: string;
  /** Updated timestamp (UTC, ISO-8601) */
  updatedAt: string;
}
