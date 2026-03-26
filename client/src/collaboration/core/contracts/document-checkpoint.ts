export interface DocumentCheckpoint {
  documentId: number;
  pluginId: string;
  engineId: string;
  pluginSchemaVersion: number;
  snapshotFormatVersion: number;
  artifactVersion: number | null;
  revision: string;
  snapshot: Uint8Array;
  compatibilityArtifact: Uint8Array | null;
}

export interface DocumentCheckpointReader {
  getRevision(): string;
  getLatestCheckpoint(): DocumentCheckpoint;
}

export interface PersistedDocument extends DocumentCheckpoint {}
