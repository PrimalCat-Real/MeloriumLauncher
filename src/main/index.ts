import 'source-map-support/register';
import 'reflect-metadata';

// Используем именованный импорт вместо default
import { Container } from 'typedi';
import { Launcher } from './core/Launcher';
import { registerModHandlers } from './ipc/Mods';
import { initApiConfig } from '@config';

registerModHandlers();
async function bootstrap() {
    await initApiConfig();
    const launcher = Container.get(Launcher);
}

bootstrap();
// Явно указываем использование Container
// const launcher = Container.get(Launcher);