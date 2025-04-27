// // import token from './public.pem';

// // export const window = {
// //     width: 900,
// //     height: 550,
// //     frame: false,
// //     resizable: false,
// //     maximizable: false,
// //     fullscreenable: false,
// //     title: 'Melorium',
// // };

// // export const api = {
// //     ws: 'ws://65.109.31.100:1370/ws',
// //     web: 'http://65.109.31.100:1370',
// //     // extraToken: token,
// // };
// export const api = {
//     ws: 'ws://185.72.144.212:1370/ws',
//     web: 'http://185.72.144.212:1370',
//     // extraToken: token,
// };

// // export const appPath = '.aurora-launcher';


// const PROXY_SERVER = 'http://185.72.144.212:1370';
// const MAIN_SERVER = 'http://185.72.144.212:1370';

// let activeApi = MAIN_SERVER;

// export async function isServerAvailable(url: string): Promise<boolean> {
//     try {
//         const controller = new AbortController();
//         const timeout = setTimeout(() => controller.abort(), 2000); // 2 секунды таймаут

//         const response = await fetch(url, {
//             method: 'HEAD',
//             signal: controller.signal,
//         });

//         clearTimeout(timeout);
//         return response.ok;
//     } catch (error) {
//         return false;
//     }
// }

// export async function initApiConfig() {
//     const isMainAvailable = await isServerAvailable(MAIN_SERVER);

//     if (!isMainAvailable) {
//         activeApi = PROXY_SERVER;
        
//         console.warn(`[API CONFIG] ❌ Main server not available, switched to proxy: ${PROXY_SERVER}`);
//         return PROXY_SERVER
//     } else {
//         console.info(`[API CONFIG] ✅ Connected to main server: ${MAIN_SERVER}`);
//         return MAIN_SERVER
//     }
    
// }


// export const window = {
//     width: 900,
//     height: 550,
//     frame: false,
//     resizable: false,
//     maximizable: false,
//     fullscreenable: false,
//     title: 'Melorium',
// };

// // export const api = {
// //     get web() {
// //         return 'ws://185.72.144.212:1370/ws'
// //     },
// //     get ws() {
// //         return  'http://185.72.144.212:1370'
// //         // return activeApi.replace(/^http/, 'ws') + '/ws';
// //     }
// //     // ,
// //     // get extraToken(){
// //     //     return token
// //     // }
// // };

// export const appPath = '.aurora-launcher';

// Конфигурация серверов
const SERVERS = [
    {
        name: 'Основной сервер',
        ws: 'ws://185.72.144.212:1370/ws',
        web: 'http://185.72.144.212:1370'
    },
    {
        name: 'Резервный сервер',
        ws: 'ws://65.109.31.100:1370/ws',
        web: 'http://65.109.31.100:1370'
    }
    
];

// Текущий активный сервер
let activeServer = SERVERS[0];

// Проверка доступности сервера
export async function isServerAvailable(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // 2 секунды таймаут

        // Проверяем доступность HTTP endpoint
        const httpCheck = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
        });

        clearTimeout(timeout);
        return httpCheck.ok;
    } catch (error) {
        console.error(`Server check failed for ${url}:`, error);
        return false;
    }
}

// Инициализация конфигурации API
export async function initApiConfig() {
    for (const server of SERVERS) {
        try {
            const isAvailable = await isServerAvailable(server.web);
            if (isAvailable) {
                activeServer = server;
                console.info(`[API CONFIG] ✅ Using ${server.name}: ${server.web}`);
                return;
            }
        } catch (error) {
            console.error(`Error checking server ${server.name}:`, error);
        }
    }
    
    console.error('[API CONFIG] ❌ All servers are unavailable, using fallback');
    activeServer = SERVERS[0]; // Возвращаемся к основному серверу как запасному варианту
}

// Экспортируемая конфигурация API
export const api = {
    get ws() {
        return activeServer.ws;
    },
    get web() {
        return activeServer.web;
    }
};

// Конфигурация окна
export const window = {
    width: 900,
    height: 550,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Melorium',
};

export const appPath = '.aurora-launcher';

// Инициализация при старте
initApiConfig().catch(console.error);