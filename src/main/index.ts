import 'source-map-support/register';
import 'reflect-metadata';

// Используем именованный импорт вместо default
import { Container } from 'typedi';
import { Launcher } from './core/Launcher';
import { registerModHandlers } from './ipc/Mods';

let launcher;

// async function bootstrap() {
//     await initApiConfig();
    
// }
registerModHandlers();

// bootstrap();
launcher = Container.get(Launcher);
// Явно указываем использование Container
// const launcher = Container.get(Launcher);