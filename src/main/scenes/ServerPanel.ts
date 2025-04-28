// import { EVENTS } from 'common/channels';
// import { ipcMain } from 'electron';
// import { Service } from 'typedi';

// import { IHandleable } from '../core/IHandleable';
// import { GameService } from '../game/GameService';
// import { LogHelper } from 'main/helpers/LogHelper';

// @Service()
// export class ServerPanelScene implements IHandleable {
//     constructor(private gameService: GameService) {}

//     initHandlers() {
//         ipcMain.handle(EVENTS.SCENES.SERVER_PANEL.GET_PROFILE, () =>
//             this.gameService.getProfile(),
//         );
//         ipcMain.handle(EVENTS.SCENES.SERVER_PANEL.GET_SERVER, () =>
//             this.gameService.getServer(),
//         );
//         ipcMain.on(EVENTS.SCENES.SERVER_PANEL.START_GAME, (_event) => {
//             LogHelper.info(`[IPC] Received ${EVENTS.SCENES.SERVER_PANEL.START_GAME} event.`);
//             this.gameService.startGame().catch(error => {
//                 LogHelper.error(`[IPC] Error during gameService.startGame execution: ${error}`);
//             });
//         });

//         ipcMain.handle('set-game-ram', async (_event, ramMb: number) => { 
//             try {
//                 LogHelper.info(`[IPC] Received set-game-ram event with ${ramMb}MB`);
//                 await this.gameService.setSelectedRam(ramMb); 
//                 return { success: true };
//             } catch (error) {
//                 LogHelper.error(`[IPC] Error in set-game-ram handler: ${error}`);
//                 return { success: false, error: "cannot set RAM" };
//             }
//         });
//     }
// }


import { EVENTS } from 'common/channels';
import { ipcMain } from 'electron';
import { Service } from 'typedi';

import { IHandleable } from '../core/IHandleable';
import { GameService } from '../game/GameService';
import { LogHelper } from 'main/helpers/LogHelper';

@Service()
export class ServerPanelScene implements IHandleable {
    constructor(private gameService: GameService) {}

    initHandlers() {
        ipcMain.handle(EVENTS.SCENES.SERVER_PANEL.GET_PROFILE, () =>
            this.gameService.getProfile(),
        );
        ipcMain.handle(EVENTS.SCENES.SERVER_PANEL.GET_SERVER, () =>
            this.gameService.getServer(),
        );
        ipcMain.on(EVENTS.SCENES.SERVER_PANEL.START_GAME, (_event) => {
            LogHelper.info(`[IPC] Received ${EVENTS.SCENES.SERVER_PANEL.START_GAME} event.`);
            this.gameService.startGame().catch(error => {
                LogHelper.error(`[IPC] Error during gameService.startGame execution: ${error}`);
            });
        });

        ipcMain.handle('set-game-ram', async (_event, ramMb: number) => { 
            try {
                LogHelper.info(`[IPC] Received set-game-ram event with ${ramMb}MB`);
                await this.gameService.setSelectedRam(ramMb); 
                return { success: true };
            } catch (error) {
                LogHelper.error(`[IPC] Error in set-game-ram handler: ${error}`);
                return { success: false, error: "cannot set RAM" };
            }
        });
    }
}
