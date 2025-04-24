import { Server } from '@aurora-launcher/core';
import { ipcRenderer } from 'electron';

import { EVENTS } from '../../common/channels';

export default class ServersListScene {
    static getServers(): Promise<Server[]> {
        return ipcRenderer.invoke(EVENTS.SCENES.SERVERS_LIST.GET_SERVERS);
    }

    static selectServer(server: Server) {
        console.log("invoke start")
        const invoke =  ipcRenderer.invoke(
            EVENTS.SCENES.SERVERS_LIST.SELECT_SERVER,
            server,
        );
        console.log(invoke)
        return invoke
    }
}
