import { Profile, Server } from '@aurora-launcher/core';
import { Service } from 'typedi';

import { APIManager } from '../api/APIManager';
import { Starter } from './Starter';
import { Updater } from './Updater';
import { Watcher } from './Watcher';
import { GameWindow } from './GameWindow';

@Service()
export class GameService {
    private selectedServer?: Server;
    private selectedProfile?: Profile;

    constructor(
        private apiService: APIManager,
        private gameUpdater: Updater,
        private gameWatcher: Watcher,
        private gameStarter: Starter,
        private gameWindow: GameWindow,
    ) {}

    async setServer(server: Server) {
        this.selectedServer = server;
        console.log(`GameService.setServer: Received server UUID: ${server.profileUUID}`);
        const fetchedProfile = await this.apiService.getProfile(server.profileUUID);
        this.selectedProfile = fetchedProfile;
        console.log(`GameService.setServer: Result of getProfile:`, fetchedProfile);
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
        console.log("profile", profile)
        console.log("server", server)
        if (!profile || !server) {
            this.gameWindow.sendToConsole('Error: Profile or server not set');
            this.gameWindow.stopGame();
            return;
        }

        try {
            await this.gameUpdater.validateClient(profile);
            await this.gameStarter.start(profile);
            await this.gameWatcher.watch();
        } catch (error) {
            this.gameWindow.sendToConsole(`${error}`);
            this.gameWindow.stopGame();
            throw error;
        }
    }
}
