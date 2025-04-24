// @ts-ignore
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
        this.selectedProfile  = {
            "configVersion": 0,
            "uuid": "a384186a-b574-4ddb-8e44-0b2a29361329",
            "sortIndex": 0,
            "servers": [
                {
                    "ip": "65.109.31.100",
                    "port": 25565,
                    "title": "Melorium"
                }
            ],
            "javaVersion": 21,
            "version": "1.21.4",
            "clientDir": "Melorium",
            "assetIndex": "19",
            "libraries": [
                {
                    "path": "ca/weblite/java-objc-bridge/1.1/java-objc-bridge-1.1.jar",
                    "sha1": "1227f9e0666314f9de41477e3ec277e542ed7f7b",
                    "type": "library",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "osx"
                            }
                        }
                    ]
                },
                {
                    "path": "com/fasterxml/jackson/core/jackson-annotations/2.13.4/jackson-annotations-2.13.4.jar",
                    "sha1": "858c6cc78e1f08a885b1613e1d817c829df70a6e",
                    "type": "library"
                },
                {
                    "path": "com/fasterxml/jackson/core/jackson-core/2.13.4/jackson-core-2.13.4.jar",
                    "sha1": "0cf934c681294b97ef6d80082faeefbe1edadf56",
                    "type": "library"
                },
                {
                    "path": "com/fasterxml/jackson/core/jackson-databind/2.13.4.2/jackson-databind-2.13.4.2.jar",
                    "sha1": "325c06bdfeb628cfb80ebaaf1a26cc1eb558a585",
                    "type": "library"
                },
                {
                    "path": "com/github/oshi/oshi-core/6.6.5/oshi-core-6.6.5.jar",
                    "sha1": "e1099981fd15dc4236c4499d82aba1276fb43a9a",
                    "type": "library"
                },
                {
                    "path": "com/github/stephenc/jcip/jcip-annotations/1.0-1/jcip-annotations-1.0-1.jar",
                    "sha1": "ef31541dd28ae2cefdd17c7ebf352d93e9058c63",
                    "type": "library"
                },
                {
                    "path": "com/google/code/gson/gson/2.11.0/gson-2.11.0.jar",
                    "sha1": "527175ca6d81050b53bdd4c457a6d6e017626b0e",
                    "type": "library"
                },
                {
                    "path": "com/google/guava/failureaccess/1.0.2/failureaccess-1.0.2.jar",
                    "sha1": "c4a06a64e650562f30b7bf9aaec1bfed43aca12b",
                    "type": "library"
                },
                {
                    "path": "com/google/guava/guava/33.3.1-jre/guava-33.3.1-jre.jar",
                    "sha1": "852f8b363da0111e819460021ca693cacca3e8db",
                    "type": "library"
                },
                {
                    "path": "com/ibm/icu/icu4j/76.1/icu4j-76.1.jar",
                    "sha1": "215f3a8e936d4069344bd75f2b1368fd58112894",
                    "type": "library"
                },
                {
                    "path": "com/microsoft/azure/msal4j/1.17.2/msal4j-1.17.2.jar",
                    "sha1": "a6211e3d71d0388929babaa0ff0951b30d001852",
                    "type": "library"
                },
                {
                    "path": "com/mojang/authlib/6.0.57/authlib-6.0.57.jar",
                    "sha1": "bded3161a7346de32213da750388ec6529fe4f6b",
                    "type": "library"
                },
                {
                    "path": "com/mojang/blocklist/1.0.10/blocklist-1.0.10.jar",
                    "sha1": "5c685c5ffa94c4cd39496c7184c1d122e515ecef",
                    "type": "library"
                },
                {
                    "path": "com/mojang/brigadier/1.3.10/brigadier-1.3.10.jar",
                    "sha1": "d15b53a14cf20fdcaa98f731af5dda654452c010",
                    "type": "library"
                },
                {
                    "path": "com/mojang/datafixerupper/8.0.16/datafixerupper-8.0.16.jar",
                    "sha1": "67d4de6d7f95d89bcf5862995fb854ebaec02a34",
                    "type": "library"
                },
                {
                    "path": "com/mojang/jtracy/1.0.29/jtracy-1.0.29.jar",
                    "sha1": "6f07dcb6a2e595c7ee2ca43b67e5d1c018ca0770",
                    "type": "library"
                },
                {
                    "path": "com/mojang/jtracy/1.0.29/jtracy-1.0.29-natives-linux.jar",
                    "sha1": "f43b6fa5cd0ecf8e6a33bc30a24b117cd0ebbfa1",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "com/mojang/jtracy/1.0.29/jtracy-1.0.29-natives-macos.jar",
                    "sha1": "d620e5b94ca81783b409d50c48b73e0ee7fdcb7d",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos"
                            }
                        }
                    ]
                },
                {
                    "path": "com/mojang/jtracy/1.0.29/jtracy-1.0.29-natives-windows.jar",
                    "sha1": "e05332cb31c7ae582dc8d8bd1bffd47c2ff7636f",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows"
                            }
                        }
                    ]
                },
                {
                    "path": "com/mojang/logging/1.5.10/logging-1.5.10.jar",
                    "sha1": "9ab1202793717af9df9c1704d0a02892067001eb",
                    "type": "library"
                },
                {
                    "path": "com/mojang/patchy/2.2.10/patchy-2.2.10.jar",
                    "sha1": "da05971b07cbb379d002cf7eaec6a2048211fefc",
                    "type": "library"
                },
                {
                    "path": "com/mojang/text2speech/1.17.9/text2speech-1.17.9.jar",
                    "sha1": "3cad216e3a7f0c19b4b394388bc9ffc446f13b14",
                    "type": "library"
                },
                {
                    "path": "com/nimbusds/content-type/2.3/content-type-2.3.jar",
                    "sha1": "e3aa0be212d7a42839a8f3f506f5b990bcce0222",
                    "type": "library"
                },
                {
                    "path": "com/nimbusds/lang-tag/1.7/lang-tag-1.7.jar",
                    "sha1": "97c73ecd70bc7e8eefb26c5eea84f251a63f1031",
                    "type": "library"
                },
                {
                    "path": "com/nimbusds/nimbus-jose-jwt/9.40/nimbus-jose-jwt-9.40.jar",
                    "sha1": "42b1dfa0360e4062951b070bac52dd8d96fd7b38",
                    "type": "library"
                },
                {
                    "path": "com/nimbusds/oauth2-oidc-sdk/11.18/oauth2-oidc-sdk-11.18.jar",
                    "sha1": "07c7ec4f4066625ff07a711ad856fa04da1ff9de",
                    "type": "library"
                },
                {
                    "path": "commons-codec/commons-codec/1.17.1/commons-codec-1.17.1.jar",
                    "sha1": "973638b7149d333563584137ebf13a691bb60579",
                    "type": "library"
                },
                {
                    "path": "commons-io/commons-io/2.17.0/commons-io-2.17.0.jar",
                    "sha1": "ddcc8433eb019fb48fe25207c0278143f3e1d7e2",
                    "type": "library"
                },
                {
                    "path": "commons-logging/commons-logging/1.3.4/commons-logging-1.3.4.jar",
                    "sha1": "b9fc14968d63a8b8a8a2c1885fe3e90564239708",
                    "type": "library"
                },
                {
                    "path": "io/netty/netty-buffer/4.1.115.Final/netty-buffer-4.1.115.Final.jar",
                    "sha1": "d5daf1030e5c36d198caf7562da2441a97ec0df6",
                    "type": "library"
                },
                {
                    "path": "io/netty/netty-codec/4.1.115.Final/netty-codec-4.1.115.Final.jar",
                    "sha1": "d326bf3a4c785b272da3db6941779a1bd5448378",
                    "type": "library"
                },
                {
                    "path": "io/netty/netty-common/4.1.115.Final/netty-common-4.1.115.Final.jar",
                    "sha1": "9da10a9f72e3f87e181d91b525174007a6fc4f11",
                    "type": "library"
                },
                {
                    "path": "io/netty/netty-handler/4.1.115.Final/netty-handler-4.1.115.Final.jar",
                    "sha1": "d54dbf68b9d88a98240107758c6b63da5e46e23a",
                    "type": "library"
                },
                {
                    "path": "io/netty/netty-resolver/4.1.115.Final/netty-resolver-4.1.115.Final.jar",
                    "sha1": "e33b4d476c03975957f5d8d0319d592bf2bc5e96",
                    "type": "library"
                },
                {
                    "path": "io/netty/netty-transport-classes-epoll/4.1.115.Final/netty-transport-classes-epoll-4.1.115.Final.jar",
                    "sha1": "11fea00408ecbd8b8d1f0698d708e37db4a01841",
                    "type": "library"
                },
                {
                    "path": "io/netty/netty-transport-native-epoll/4.1.115.Final/netty-transport-native-epoll-4.1.115.Final-linux-aarch_64.jar",
                    "sha1": "a80b32f98ceb4e27958c0ceaf22ddad9ea6c0d4e",
                    "type": "library",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "io/netty/netty-transport-native-epoll/4.1.115.Final/netty-transport-native-epoll-4.1.115.Final-linux-x86_64.jar",
                    "sha1": "a6cc58c4a259bad159cbb06120cea9b3474e86a0",
                    "type": "library",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "io/netty/netty-transport-native-unix-common/4.1.115.Final/netty-transport-native-unix-common-4.1.115.Final.jar",
                    "sha1": "dc96c67d06cd6b5eb677f2728f27bf2e3d9a7284",
                    "type": "library"
                },
                {
                    "path": "io/netty/netty-transport/4.1.115.Final/netty-transport-4.1.115.Final.jar",
                    "sha1": "39cef77c1a25908ac1abf4960c2e789f0bf70ff9",
                    "type": "library"
                },
                {
                    "path": "it/unimi/dsi/fastutil/8.5.15/fastutil-8.5.15.jar",
                    "sha1": "1e885b40c9563ab0d3899b871fd0b30e958705dc",
                    "type": "library"
                },
                {
                    "path": "net/java/dev/jna/jna-platform/5.15.0/jna-platform-5.15.0.jar",
                    "sha1": "86b502cad57d45da172b5e3231c537b042e296ef",
                    "type": "library"
                },
                {
                    "path": "net/java/dev/jna/jna/5.15.0/jna-5.15.0.jar",
                    "sha1": "01ee1d80ff44f08280188f7c0e740d57207841ac",
                    "type": "library"
                },
                {
                    "path": "net/minidev/accessors-smart/2.5.1/accessors-smart-2.5.1.jar",
                    "sha1": "19b820261eb2e7de7d5bde11d1c06e4501dd7e5f",
                    "type": "library"
                },
                {
                    "path": "net/minidev/json-smart/2.5.1/json-smart-2.5.1.jar",
                    "sha1": "4c11d2808d009132dfbbf947ebf37de6bf266c8e",
                    "type": "library"
                },
                {
                    "path": "net/sf/jopt-simple/jopt-simple/5.0.4/jopt-simple-5.0.4.jar",
                    "sha1": "4fdac2fbe92dfad86aa6e9301736f6b4342a3f5c",
                    "type": "library"
                },
                {
                    "path": "org/apache/commons/commons-compress/1.27.1/commons-compress-1.27.1.jar",
                    "sha1": "a19151084758e2fbb6b41eddaa88e7b8ff4e6599",
                    "type": "library"
                },
                {
                    "path": "org/apache/commons/commons-lang3/3.17.0/commons-lang3-3.17.0.jar",
                    "sha1": "b17d2136f0460dcc0d2016ceefca8723bdf4ee70",
                    "type": "library"
                },
                {
                    "path": "org/apache/httpcomponents/httpclient/4.5.14/httpclient-4.5.14.jar",
                    "sha1": "1194890e6f56ec29177673f2f12d0b8e627dec98",
                    "type": "library"
                },
                {
                    "path": "org/apache/httpcomponents/httpcore/4.4.16/httpcore-4.4.16.jar",
                    "sha1": "51cf043c87253c9f58b539c9f7e44c8894223850",
                    "type": "library"
                },
                {
                    "path": "org/apache/logging/log4j/log4j-api/2.24.1/log4j-api-2.24.1.jar",
                    "sha1": "7ebeb12c20606373005af4232cd0ecca72613dda",
                    "type": "library"
                },
                {
                    "path": "org/apache/logging/log4j/log4j-core/2.24.1/log4j-core-2.24.1.jar",
                    "sha1": "c85285146f28d8c8962384f786e2dff04172fb43",
                    "type": "library"
                },
                {
                    "path": "org/apache/logging/log4j/log4j-slf4j2-impl/2.24.1/log4j-slf4j2-impl-2.24.1.jar",
                    "sha1": "8e3ddc96464ef7f768823e7e001a52b23de8cd0a",
                    "type": "library"
                },
                {
                    "path": "org/jcraft/jorbis/0.0.17/jorbis-0.0.17.jar",
                    "sha1": "8872d22b293e8f5d7d56ff92be966e6dc28ebdc6",
                    "type": "library"
                },
                {
                    "path": "org/joml/joml/1.10.8/joml-1.10.8.jar",
                    "sha1": "fc0a71dad90a2cf41d82a76156a0e700af8e4f8d",
                    "type": "library"
                },
                {
                    "path": "org/lwjgl/lwjgl-freetype/3.3.3/lwjgl-freetype-3.3.3.jar",
                    "sha1": "a0db6c84a8becc8ca05f9dbfa985edc348a824c7",
                    "type": "library"
                },
                {
                    "path": "org/lwjgl/lwjgl-freetype/3.3.3/lwjgl-freetype-3.3.3-natives-linux.jar",
                    "sha1": "149070a5480900347071b7074779531f25a6e3dc",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-freetype/3.3.3/lwjgl-freetype-3.3.3-natives-macos-arm64.jar",
                    "sha1": "b0a8c9baa9d1f54ac61e1ab9640c7659e7fa700c",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-freetype/3.3.3/lwjgl-freetype-3.3.3-natives-macos-patch.jar",
                    "sha1": "806d869f37ce0df388a24e17aaaf5ca0894d851b",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos",
                                "arch": "patch"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-freetype/3.3.3/lwjgl-freetype-3.3.3-natives-windows.jar",
                    "sha1": "81091b006dbb43fab04c8c638e9ac87c51b4096d",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-freetype/3.3.3/lwjgl-freetype-3.3.3-natives-windows-arm64.jar",
                    "sha1": "82028265a0a2ff33523ca75137ada7dc176e5210",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-freetype/3.3.3/lwjgl-freetype-3.3.3-natives-windows-x86.jar",
                    "sha1": "15a8c1de7f51d07a92eae7ce1222557073a0c0c3",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "x86"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3.jar",
                    "sha1": "efa1eb78c5ccd840e9f329717109b5e892d72f8e",
                    "type": "library"
                },
                {
                    "path": "org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3-natives-linux.jar",
                    "sha1": "a03684c5e4b1b1dbbe0d29dbbdc27b985b6840f2",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3-natives-macos.jar",
                    "sha1": "a1bf400f6bc64e6195596cb1430dafda46090751",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3-natives-macos-arm64.jar",
                    "sha1": "ee8cc78d0a4a5b3b4600fade6d927c9fc320c858",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3-natives-windows.jar",
                    "sha1": "e449e28b4891fc423c54c85fbc5bb0b9efece67a",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3-natives-windows-arm64.jar",
                    "sha1": "f27018dc74f6289574502b46cce55d52817554e2",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3-natives-windows-x86.jar",
                    "sha1": "32334f3fd5270a59bad9939a93115acb6de36dcf",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "x86"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-jemalloc/3.3.3/lwjgl-jemalloc-3.3.3.jar",
                    "sha1": "b543467b7ff3c6920539a88ee602d34098628be5",
                    "type": "library"
                },
                {
                    "path": "org/lwjgl/lwjgl-jemalloc/3.3.3/lwjgl-jemalloc-3.3.3-natives-linux.jar",
                    "sha1": "4f86728bf449b1dd61251c4e0ac01df1389cb51e",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-jemalloc/3.3.3/lwjgl-jemalloc-3.3.3-natives-macos.jar",
                    "sha1": "2906637657a57579847238c9c72d2c4bde7083f8",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-jemalloc/3.3.3/lwjgl-jemalloc-3.3.3-natives-macos-arm64.jar",
                    "sha1": "e9412c3ff8cb3a3bad1d3f52909ad74d8a5bdad1",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-jemalloc/3.3.3/lwjgl-jemalloc-3.3.3-natives-windows.jar",
                    "sha1": "426222fc027602a5f21b9c0fe79cde6a4c7a011f",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-jemalloc/3.3.3/lwjgl-jemalloc-3.3.3-natives-windows-arm64.jar",
                    "sha1": "ba1f3fed0ee4be0217eaa41c5bbfb4b9b1383c33",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-jemalloc/3.3.3/lwjgl-jemalloc-3.3.3-natives-windows-x86.jar",
                    "sha1": "f6063b6e0f23be483c5c88d84ce51b39dc69126c",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "x86"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-openal/3.3.3/lwjgl-openal-3.3.3.jar",
                    "sha1": "daada81ceb5fc0c291fbfdd4433cb8d9423577f2",
                    "type": "library"
                },
                {
                    "path": "org/lwjgl/lwjgl-openal/3.3.3/lwjgl-openal-3.3.3-natives-linux.jar",
                    "sha1": "3037360cc4595079bea240af250b6d1a527e0905",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-openal/3.3.3/lwjgl-openal-3.3.3-natives-macos.jar",
                    "sha1": "8df8338bfa77f2ebabef4e58964bd04d24805cbf",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-openal/3.3.3/lwjgl-openal-3.3.3-natives-macos-arm64.jar",
                    "sha1": "0c78b078de2fb52f45aa55d04db889a560f3544f",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-openal/3.3.3/lwjgl-openal-3.3.3-natives-windows.jar",
                    "sha1": "cf83862ae95d98496b26915024c7e666d8ab1c8f",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-openal/3.3.3/lwjgl-openal-3.3.3-natives-windows-arm64.jar",
                    "sha1": "8e0615235116b9e4160dfe87bec90f5f6378bf72",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-openal/3.3.3/lwjgl-openal-3.3.3-natives-windows-x86.jar",
                    "sha1": "87b8d5050e3adb46bb58fe1cb2669a4a48fce10d",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "x86"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-opengl/3.3.3/lwjgl-opengl-3.3.3.jar",
                    "sha1": "02f6b0147078396a58979125a4c947664e98293a",
                    "type": "library"
                },
                {
                    "path": "org/lwjgl/lwjgl-opengl/3.3.3/lwjgl-opengl-3.3.3-natives-linux.jar",
                    "sha1": "62c70a4b00ca5391882b0f4b787c1588d24f1c86",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-opengl/3.3.3/lwjgl-opengl-3.3.3-natives-macos.jar",
                    "sha1": "1bd45997551ae8a28469f3a2b678f4b7289e12c0",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-opengl/3.3.3/lwjgl-opengl-3.3.3-natives-macos-arm64.jar",
                    "sha1": "d213ddef27637b1af87961ffa94d6b27036becc8",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-opengl/3.3.3/lwjgl-opengl-3.3.3-natives-windows.jar",
                    "sha1": "e6c1eec8be8a71951b830a4d69efc01c6531900c",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-opengl/3.3.3/lwjgl-opengl-3.3.3-natives-windows-arm64.jar",
                    "sha1": "65e956d3735a1abdc82eff4baec1b61174697d4b",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-opengl/3.3.3/lwjgl-opengl-3.3.3-natives-windows-x86.jar",
                    "sha1": "0d32d833dcaa2f355a886eaf21f0408b5f03241d",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "x86"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-stb/3.3.3/lwjgl-stb-3.3.3.jar",
                    "sha1": "25dd6161988d7e65f71d5065c99902402ee32746",
                    "type": "library"
                },
                {
                    "path": "org/lwjgl/lwjgl-stb/3.3.3/lwjgl-stb-3.3.3-natives-linux.jar",
                    "sha1": "fd1271ccd9d85eff2fa31f3fd543e02ccfaf5041",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-stb/3.3.3/lwjgl-stb-3.3.3-natives-macos.jar",
                    "sha1": "472792c98fb2c1557c060cb9da5fca6a9773621f",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-stb/3.3.3/lwjgl-stb-3.3.3-natives-macos-arm64.jar",
                    "sha1": "51c6955571fbcdb7bb538c6aa589b953b584c6af",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-stb/3.3.3/lwjgl-stb-3.3.3-natives-windows.jar",
                    "sha1": "1d9facdf6541de114b0f963be33505b7679c78cb",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-stb/3.3.3/lwjgl-stb-3.3.3-natives-windows-arm64.jar",
                    "sha1": "a584ab44de569708871f0a79561f4d8c37487f2c",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-stb/3.3.3/lwjgl-stb-3.3.3-natives-windows-x86.jar",
                    "sha1": "b5c874687b9aac1a936501d4ed2c49567fd1b575",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "x86"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-tinyfd/3.3.3/lwjgl-tinyfd-3.3.3.jar",
                    "sha1": "82d755ca94b102e9ca77283b9e2dc46d1b15fbe5",
                    "type": "library"
                },
                {
                    "path": "org/lwjgl/lwjgl-tinyfd/3.3.3/lwjgl-tinyfd-3.3.3-natives-linux.jar",
                    "sha1": "d8d58daa0c3e5fd906fee96f5fddbcbc07cc308b",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-tinyfd/3.3.3/lwjgl-tinyfd-3.3.3-natives-macos.jar",
                    "sha1": "6598081e346a03038a8be68eb2de614a1c2eac68",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-tinyfd/3.3.3/lwjgl-tinyfd-3.3.3-natives-macos-arm64.jar",
                    "sha1": "406feedb977372085a61eb0fee358183f4f4c67a",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-tinyfd/3.3.3/lwjgl-tinyfd-3.3.3-natives-windows.jar",
                    "sha1": "a6697981b0449a5087c1d546fc08b4f73e8f98c9",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-tinyfd/3.3.3/lwjgl-tinyfd-3.3.3-natives-windows-arm64.jar",
                    "sha1": "a88c494f3006eb91a7433b12a3a55a9a6c20788b",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl-tinyfd/3.3.3/lwjgl-tinyfd-3.3.3-natives-windows-x86.jar",
                    "sha1": "c336c84ee88cccb495c6ffa112395509e7378e8a",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "x86"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar",
                    "sha1": "29589b5f87ed335a6c7e7ee6a5775f81f97ecb84",
                    "type": "library"
                },
                {
                    "path": "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-linux.jar",
                    "sha1": "1713758e3660ba66e1e954396fd18126038b33c0",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "linux"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-macos.jar",
                    "sha1": "33a6efa288390490ce6eb6c3df47ac21ecf648cf",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-macos-arm64.jar",
                    "sha1": "226246e75f6bd8d4e1895bdce8638ef87808d114",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "macos",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar",
                    "sha1": "a5ed18a2b82fc91b81f40d717cb1f64c9dcb0540",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-arm64.jar",
                    "sha1": "e9aca8c5479b520a2a7f0d542a118140e812c5e8",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "arm64"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-x86.jar",
                    "sha1": "9e670718e050aeaeea0c2d5b907cffb142f2e58f",
                    "type": "native",
                    "rules": [
                        {
                            "action": "allow",
                            "os": {
                                "name": "windows",
                                "arch": "x86"
                            }
                        }
                    ]
                },
                {
                    "path": "org/lz4/lz4-java/1.8.0/lz4-java-1.8.0.jar",
                    "sha1": "4b986a99445e49ea5fbf5d149c4b63f6ed6c6780",
                    "type": "library"
                },
                {
                    "path": "org/ow2/asm/asm/9.7.1/asm-9.7.1.jar",
                    "sha1": "aa205cf0a06dbd8e04ece91c0b37c3f5d567546a",
                    "type": "library"
                },
                {
                    "path": "org/slf4j/slf4j-api/2.0.16/slf4j-api-2.0.16.jar",
                    "sha1": "0172931663a09a1fa515567af5fbef00897d3c04",
                    "type": "library"
                },
                {
                    "path": "org/ow2/asm/asm/9.7.1/asm-9.7.1.jar",
                    "sha1": "f0ed132a49244b042cd0e15702ab9f2ce3cc8436",
                    "type": "library"
                },
                {
                    "path": "org/ow2/asm/asm-analysis/9.7.1/asm-analysis-9.7.1.jar",
                    "sha1": "f97a3b319f0ed6a8cd944dc79060d3912a28985f",
                    "type": "library"
                },
                {
                    "path": "org/ow2/asm/asm-commons/9.7.1/asm-commons-9.7.1.jar",
                    "sha1": "406c6a2225cfe1819f102a161e54cc16a5c24f75",
                    "type": "library"
                },
                {
                    "path": "org/ow2/asm/asm-tree/9.7.1/asm-tree-9.7.1.jar",
                    "sha1": "3a53139787663b139de76b627fca0084ab60d32c",
                    "type": "library"
                },
                {
                    "path": "org/ow2/asm/asm-util/9.7.1/asm-util-9.7.1.jar",
                    "sha1": "9e23359b598ec6b74b23e53110dd5c577adf2243",
                    "type": "library"
                },
                {
                    "path": "net/fabricmc/sponge-mixin/0.15.4+mixin.0.8.7/sponge-mixin-0.15.4+mixin.0.8.7.jar",
                    "sha1": "6a12aacc794f1078458433116e9ed42c1cc98096",
                    "type": "library"
                },
                {
                    "path": "net/fabricmc/intermediary/1.21.4/intermediary-1.21.4.jar",
                    "sha1": "de610a8c6216662541bf345ba07ab8d099e1ec25",
                    "type": "library"
                },
                {
                    "path": "net/fabricmc/fabric-loader/0.16.13/fabric-loader-0.16.13.jar",
                    "sha1": "98c9beaf1e9b7290882be44120b8a3967e7b1f28",
                    "type": "library"
                }
            ],
            "gameJar": "minecraft.jar",
            "mainClass": "net.fabricmc.loader.impl.launch.knot.KnotClient",
            "jvmArgs": [],
            "clientArgs": [],
            "update": ["server.dat"],
            "updateVerify": ["resourcepacks/"],
            "updateExclusions": ["mods/.cache/"],
            "whiteListType": "null"
        }
        // const fetchedProfile = await this.apiService.getProfile(server.profileUUID);
        // this.selectedProfile = fetchedProfile;
        
        // console.log(`GameService.setServer: Result of getProfile:`, fetchedProfile);
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
