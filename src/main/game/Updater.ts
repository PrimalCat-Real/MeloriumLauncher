import { mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';

import {
    HashedFile,
    HashHelper,
    HttpHelper,
    JsonHelper,
    Profile,
} from '@aurora-launcher/core';
import { api as apiConfig } from '@config';
import { StorageHelper } from 'main/helpers/StorageHelper';
import pMap from 'p-map';
import { Service } from 'typedi';

import { APIManager } from '../api/APIManager';
import { GameWindow } from './GameWindow';
import { LibrariesMatcher } from './LibrariesMatcher';

@Service()
export class Updater {
    private currentHttpEndpointIndex = 0;
    private readonly httpEndpoints = [
        // apiConfig.web || 'http://185.72.144.212:1370',
        
        'http://185.72.144.212:1370',
        'http://65.109.31.100:1370',
    ];
    private requestTimeout = 3000;
    constructor(
        private api: APIManager,
        private gameWindow: GameWindow,
    ) {}

    private async initializeHttpEndpoint(): Promise<void> {
        this.gameWindow.sendToConsole('Checking endpoints');
        for (let i = 0; i < this.httpEndpoints.length; i++) {
            const endpoint = this.httpEndpoints[i];
            const isAvailable = await this.checkEndpointAvailability(endpoint, this.requestTimeout);
    
            if (isAvailable) {
                this.currentHttpEndpointIndex = i;
                this.gameWindow.sendToConsole(`Using endpoint ${i+1}`);
                console.log(`Using endpoint: ${endpoint}`);
                return;
            } else {
                this.gameWindow.sendToConsole(`Endpoint ${i+1} is unavailable.`);
                console.log(`Endpoint ${endpoint} is unavailable.`);
            }
        }
    
        console.error('All HTTP endpoints are unavailable!');
    }
    
    private async checkEndpointAvailability(url: string, timeout: number = 5000): Promise<boolean> {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
    
            await fetch(url, { signal: controller.signal });
            clearTimeout(id);
    
            return true;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log(`Request to ${url} timed out.`);
            } else {
                console.error(`Error checking endpoint ${url}:`, error.message);
            }
            return false;
        }
    }

    // private async initializeHttpEndpoint(): Promise<void> {
    //     const testUrl = `${this.httpEndpoints[0]}/status`; // предполагаем, что есть endpoint /status
    //     const isAvailable = await this.checkEndpointAvailability(testUrl, this.requestTimeout);
    
    //     if (!isAvailable) {
    //         this.currentHttpEndpointIndex = 1; // fallback на 65.109.31.100
    //         console.log(`Primary endpoint is unavailable. Switched to: ${this.httpEndpoints[1]}`);
    //     } else {
    //         console.log(`Primary endpoint is available: ${this.httpEndpoints[0]}`);
    //     }
    // }
    
    

    async validateClient(clientArgs: Profile): Promise<void> {
        await this.initializeHttpEndpoint();
        await this.validateAssets(clientArgs);
        await this.validateLibraries(clientArgs);
        await this.validateGameFiles(clientArgs);
    }

    async validateAssets(clientArgs: Profile): Promise<void> {
        this.gameWindow.sendToConsole('Load assets files');

        const assetIndexPath = `indexes/${clientArgs.assetIndex}.json`;
        const filePath = join(StorageHelper.assetsDir, assetIndexPath);
        mkdirSync(dirname(filePath), { recursive: true });

        const assetIndexUrl = this.getFileUrl(assetIndexPath, 'assets');
        const assetFile = await HttpHelper.getResource(assetIndexUrl);
        await writeFile(filePath, assetFile);

        const { objects } = JsonHelper.fromJson<Assets>(assetFile);

        const assetsHashes = Object.values(objects)
            .sort((a, b) => b.size - a.size)
            .map((hash) => ({
                ...hash,
                path: `objects/${hash.hash.slice(0, 2)}/${hash.hash}`,
            }));

        const totalSize = assetsHashes.reduce(
            (prev, cur) => prev + cur.size,
            0,
        );
        let loaded = 0;

        await pMap(
            assetsHashes,
            async (hash) => {
                await this.validateAndDownloadFile(
                    hash.path,
                    hash.hash,
                    StorageHelper.assetsDir,
                    'assets',
                );

                this.gameWindow.sendProgress({
                    total: totalSize,
                    loaded: (loaded += hash.size),
                    type: 'size',
                });
            },
            { concurrency: 4 },
        );
    }

    async validateLibraries(clientArgs: Profile): Promise<void> {
        this.gameWindow.sendToConsole('Load libraries files');

        const usedLibraries = clientArgs.libraries.filter((library) =>
            LibrariesMatcher.match(library.rules),
        );

        let loaded = 0;

        await pMap(
            usedLibraries,
            async (library) => {
                await this.validateAndDownloadFile(
                    library.path,
                    library.sha1,
                    StorageHelper.librariesDir,
                    'libraries',
                );

                this.gameWindow.sendProgress({
                    total: usedLibraries.length,
                    loaded: (loaded += 1),
                    type: 'count',
                });
            },
            { concurrency: 4 },
        );
    }

    async validateGameFiles(clientArgs: Profile): Promise<void> {
        this.gameWindow.sendToConsole('Load client files');
    
        // Define mods directory path, matching the hardcoded path in getAllLocalModsInfo
        const modsDir = join(StorageHelper.clientsDir, 'Melorium', 'mods');
        await fs.mkdir(modsDir, { recursive: true });
    
        // Get BASE names of disabled mods
        const disabledModsBaseNames = await getDisabledMods(modsDir);
        const disabledModBaseNamesSet = new Set(disabledModsBaseNames); // Use Set for efficient lookup
    
        const hashes = await this.api.getUpdates(clientArgs.clientDir);
        const serverMods: HashedFile[] = hashes.filter((file: HashedFile) => file.path.includes('mods/'));
    
        // Get expected BASE names from server mods
        const cleanedModsWith = serverMods.map((modFile: HashedFile) => {
            const modPath: string = modFile.path;
            const modSize: number = modFile.size;
            const modHash: string = modFile.sha1;
            const lastSlashIndex = modPath.lastIndexOf('/');
            let filename = lastSlashIndex === -1 ? modPath : modPath.substring(lastSlashIndex + 1);
    
            // Extract base name (remove .jar.disabled first, then .jar)
            if (filename.endsWith('.disabled')) {
                filename = filename.slice(0, -9);
            }
            if (filename.endsWith('.jar')) {
                 filename = filename.slice(0, -4);
            }
            return { name: filename, hash: modHash, size: modSize }; // name is the base name
        });
        const expectedModBaseNames = new Set(cleanedModsWith.map((mod) => mod.name)); // Set of expected base names
    
        LogHelper.info('Expected mods from server (base names):');
        LogHelper.info(Array.from(expectedModBaseNames)); 
        LogHelper.info('Disabled mods (base names):');
        LogHelper.info(Array.from(disabledModBaseNamesSet)); 
    
        this.gameWindow.sendToConsole('Checking local mods folder...');
        try {
            const localFilenames = await getAllLocalModsInfo(modsDir);
            LogHelper.info(
                `Found ${localFilenames.length} files/folders locally in ${modsDir}`,
            );
    
            const deletePromises: Promise<void>[] = [];
    
            for (const localFilename of localFilenames) {
                let localBaseName = '';
                let isModFile = false;
    
                if (localFilename.endsWith('.jar.disabled')) {
                    localBaseName = localFilename.slice(0, -13);
                    isModFile = true;
                } else if (localFilename.endsWith('.jar')) {
                    localBaseName = localFilename.slice(0, -4);
                    isModFile = true;
                }
    
                if (isModFile) {
                    if (
                        !disabledModBaseNamesSet.has(localBaseName) &&
                        !expectedModBaseNames.has(localBaseName)
                    ) {
                        const filePathToDelete = join(modsDir, localFilename);
                        LogHelper.info(
                            `Deleting file (neither disabled nor expected): ${localFilename}`,
                        );
                        this.gameWindow.sendToConsole(
                            `Removing: ${localFilename}`,
                        );
                        deletePromises.push(
                            fs.unlink(filePathToDelete).catch((err) => {
                                LogHelper.error(
                                    `Failed to delete ${filePathToDelete}: ${
                                        (err as Error).message
                                    }`,
                                );
                            }),
                        );
                    }
                }
            }
    
            await Promise.all(deletePromises);
            this.gameWindow.sendToConsole('Finished checking local mods folder.');
    
        } catch (error: any) {
             LogHelper.error(
                 `Error during local mods check in ${modsDir}: ${error.message}`,
             );
             this.gameWindow.sendToConsole(
                 `Error checking mods folder: ${error.message}`,
             );
             // throw error; // Optional: stop execution if cleaning fails
        }
        hashes.sort(
            (a: { size: number }, b: { size: number }) => b.size - a.size,
        );
        const totalSize = hashes.reduce(
            (prev: any, cur: { size: any }) => prev + cur.size,
            0,
        );
        let loaded = 0;

        await pMap(
            hashes,
            async (hash: any) => {
            
                
                
                await this.validateAndDownloadFile(
                    hash.path,
                    hash.sha1,
                    StorageHelper.clientsDir,
                    'clients',
                    disabledModsBaseNames
                );

                this.gameWindow.sendProgress({
                    total: totalSize,
                    loaded: (loaded += hash.size),
                    type: 'size',
                });
            },
            { concurrency: 4 },
        );
    }

    private getFileUrl(
        path: string,
        type: 'clients' | 'libraries' | 'assets',
    ): URL {
        return new URL(
            `files/${type}/${path.replace('\\', '/')}`,
            this.httpEndpoints[this.currentHttpEndpointIndex],
        );
    }
    private async rotateHttpEndpoint() {
        this.currentHttpEndpointIndex = (this.currentHttpEndpointIndex + 1) % this.httpEndpoints.length;
        console.log(`Switching HTTP endpoint to: ${this.httpEndpoints[this.currentHttpEndpointIndex]}`);
    }
    async validateAndDownloadFile(
        path: string,
        sha1: string,
        rootDir: string,
        type: 'clients' | 'libraries' | 'assets',
        disabledMods?: string[]
    ): Promise<void> {

    
        const filePath = join(rootDir, path);
        mkdirSync(dirname(filePath), { recursive: true });
    
        const fileUrl = this.getFileUrl(path, type);
    
        try {
            const fileHash = await HashHelper.getHashFromFile(filePath, 'sha1');
            if (fileHash === sha1) return;
        } catch (error) {

        }
    
        try {
            
            let shouldDownload = true;
            // if(path.includes("options.txt")){
            //     shouldDownload = false;
            // }
            // if(path.includes("options")){
            //     shouldDownload = false;
            // }
            if (disabledMods && disabledMods.length > 0) {
                for (const disabledMod of disabledMods) {
                    if (path.includes(disabledMod)) {
                        shouldDownload = false;
                        break;
                    }
                }
            }

            if (shouldDownload) {
                await HttpHelper.downloadFile(fileUrl, filePath);
            }
           
        } catch (error) {
            throw new Error(`file ${fileUrl} not found`);
        }
    }
    
}

import fs from "fs/promises";
import path from "path";
import { LogHelper } from 'main/helpers/LogHelper';

async function getDisabledMods(modsDir: string): Promise<string[]> {
    const modsPath = join(StorageHelper.clientsDir, 'Melorium', 'mods');
    
    await fs.mkdir(modsPath, { recursive: true });

    const files = await fs.readdir(modsPath);
    return files
        .filter(f => f.endsWith(".disabled"))
        .map(f => f.replace(/\.disabled$/, ""));
}

async function getAllLocalModsInfo(modsDir: string): Promise<string[]> {
    const modsPath = join(StorageHelper.clientsDir, 'Melorium', 'mods');
    
    await fs.mkdir(modsPath, { recursive: true });

    const files = await fs.readdir(modsPath);
    return files
}


// TODO: Move to @aurora-launcher/core
/**
 * For assets
 */
export interface Assets {
    /**
     * Найдено в https://launchermeta.mojang.com/v1/packages/3d8e55480977e32acd9844e545177e69a52f594b/pre-1.6.json \
     * до версии 1.6 (если точнее до снапшота 13w23b)
     */
    map_to_resources?: boolean;
    /**
     * Найдено в https://launchermeta.mojang.com/v1/packages/770572e819335b6c0a053f8378ad88eda189fc14/legacy.json \
     * начиная с версии версии 1.6 (если точнее с снапшота 13w24a) и до 1.7.2 (13w48b)
     */
    virtual?: boolean;
    objects: { [key: string]: Asset };
}

export interface Asset {
    hash: string;
    size: number;
}
