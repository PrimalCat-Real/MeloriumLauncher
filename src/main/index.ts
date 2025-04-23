import 'source-map-support/register';
import 'reflect-metadata';

// Используем именованный импорт вместо default
import { Container } from 'typedi';
import { Launcher } from './core/Launcher';

// Явно указываем использование Container
const launcher = Container.get(Launcher);