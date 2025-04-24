import 'source-map-support/register';
import 'reflect-metadata';

// Используем именованный импорт вместо default
import { Container } from 'typedi';
import { Launcher } from './core/Launcher';
import { registerModHandlers } from './ipc/Mods';
import { initApiConfig } from '@config';

let launcher;

async function bootstrap() {
    await initApiConfig();
    launcher = Container.get(Launcher);
}
registerModHandlers();

bootstrap();

// Явно указываем использование Container
// const launcher = Container.get(Launcher);