// import token from './public.pem';

// export const window = {
//     width: 900,
//     height: 550,
//     frame: false,
//     resizable: false,
//     maximizable: false,
//     fullscreenable: false,
//     title: 'Melorium',
// };

export const api = {
    ws: 'ws://185.72.144.212:1370/ws',
    web: 'http://185.72.144.212:1370',
    // extraToken: token,
};

// export const appPath = '.aurora-launcher';


const PROXY_SERVER = 'http://185.72.144.212:1370';
const MAIN_SERVER = 'http://185.72.144.212:1370';

let activeApi = MAIN_SERVER;

export async function isServerAvailable(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // 2 секунды таймаут

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
        });

        clearTimeout(timeout);
        return response.ok;
    } catch (error) {
        return false;
    }
}

export async function initApiConfig() {
    const isMainAvailable = await isServerAvailable(MAIN_SERVER);

    if (!isMainAvailable) {
        activeApi = PROXY_SERVER;
        
        console.warn(`[API CONFIG] ❌ Main server not available, switched to proxy: ${PROXY_SERVER}`);
        return PROXY_SERVER
    } else {
        console.info(`[API CONFIG] ✅ Connected to main server: ${MAIN_SERVER}`);
        return MAIN_SERVER
    }
    
}


export const window = {
    width: 900,
    height: 550,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Melorium',
};

// export const api = {
//     get web() {
//         return 'ws://185.72.144.212:1370/ws'
//     },
//     get ws() {
//         return  'http://185.72.144.212:1370'
//         // return activeApi.replace(/^http/, 'ws') + '/ws';
//     }
//     // ,
//     // get extraToken(){
//     //     return token
//     // }
// };

export const appPath = '.aurora-launcher';
