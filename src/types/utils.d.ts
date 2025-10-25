export interface VersionResponse {
    version: string;
    timestamp: number;
}

export interface LocalMeloriamConfig {
    version: string;
    [key: string]: any;
}