// @ts-ignore
import { Profile, Server } from '@aurora-launcher/core';
import { Service } from 'typedi';

import { APIManager } from '../api/APIManager';
import { Starter } from './Starter';
import { Updater } from './Updater';
import { Watcher } from './Watcher';
import { GameWindow } from './GameWindow';
import { LogHelper } from 'main/helpers/LogHelper';

@Service()
export class GameService {
    private selectedServer?: Server;
    private selectedProfile?: Profile;
    private selectedRamMB?: number;

    constructor(
        private apiService: APIManager,
        private gameUpdater: Updater,
        private gameWatcher: Watcher,
        private gameStarter: Starter,
        private gameWindow: GameWindow,
    ) {}

    async setServer(server: Server) {
        this.selectedServer = server;
        
        console.log( await this.apiService.getProfile(server.profileUUID))
        
        const fetchedProfile = await this.apiService.getProfile(server.profileUUID);
        this.selectedProfile = fetchedProfile;
        
        console.log(`GameService.setServer: Result of getProfile:`, fetchedProfile);
    }

    async setSelectedRam(ramMb: number): Promise<void> {

        if (typeof ramMb === 'number' && ramMb >= 1024) { 
            LogHelper.info(`[GameService] Setting selected RAM to: ${ramMb}MB`);
            this.selectedRamMB = ramMb;
        } else {
             LogHelper.warn(`[GameService] Attempted to set invalid RAM value: ${ramMb}MB. Keeping previous value: ${this.selectedRamMB}MB`);
        }
   }


    getServer() {
        return this.selectedServer;
    }

    getProfile() {
        return this.selectedProfile;
    }

    async startGame() {
        const profile = this.selectedProfile;
        const server = this.selectedServer;

        const ramToUse = this.selectedRamMB;
        console.log("profile", profile)
        console.log("server", server)
        if (!profile || !server) {
            this.gameWindow.sendToConsole('Error: Profile or server not set');
            this.gameWindow.stopGame();
            return;
        }

        try {
            await this.gameUpdater.validateClient(profile);
            await this.gameStarter.start(profile, ramToUse);
            await this.gameWatcher.watch();
        } catch (error) {
            this.gameWindow.sendToConsole(`${error}`);
            this.gameWindow.stopGame();
            throw error;
        }
    }
}
