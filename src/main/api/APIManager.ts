import { AuroraAPI } from '@aurora-launcher/api';
import { api as apiConfig } from '@config';
import { Service } from 'typedi';

import { LogHelper } from '../helpers/LogHelper';

@Service()
export class APIManager {
    private currentEndpointIndex = 0;
    private readonly endpoints = [
        // apiConfig.ws || 'ws://185.72.144.212:1370/ws',//65.109.31.100:1370/ws
        'ws:/65.109.31.100:1370/ws',
        'ws://185.72.144.212:1370/ws'
    ];
    
    private api!: AuroraAPI;

    constructor() {
        this.createApiInstance();
    }

    private createApiInstance() {
        const currentEndpoint = this.endpoints[this.currentEndpointIndex];
        this.api = new AuroraAPI(currentEndpoint, {
            onClose: () => setTimeout(() => this.initConnection(), 3000),
        });
    }

    private rotateEndpoint() {
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
        LogHelper.debug(`Switching to endpoint: ${this.endpoints[this.currentEndpointIndex]}`);
        this.createApiInstance();
    }

    async initConnection() {
        try {
            await this.api.connect();
        } catch (error) {
            LogHelper.error(`Connection failed to ${this.endpoints[this.currentEndpointIndex]}: ${error}`);
            this.rotateEndpoint();
            await this.initConnection(); // Попробовать снова с новым endpoint
        }
    }

    public auth(login: string, password: string) {
        return this.api.auth(login, password);
    }

    public getServers() {
        return this.api.getServers();
    }

    public getProfile(uuid: string) {
        return this.api.getProfile(uuid);
    }

    public getUpdates(dir: string) {
        return this.api.getUpdates(dir);
    }
}