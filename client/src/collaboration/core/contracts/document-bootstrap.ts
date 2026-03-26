export interface DocumentBootstrapHeader {
  pluginSchemaVersion: number;
  snapshotFormatVersion: number;
  artifactVersion: number | null;
  revision: string;
  snapshotAvailable: boolean;
  artifactAvailable: boolean;
}

export interface DocumentBootstrapPayload extends DocumentBootstrapHeader {
  pluginId: string;
  engineId: string;
}
