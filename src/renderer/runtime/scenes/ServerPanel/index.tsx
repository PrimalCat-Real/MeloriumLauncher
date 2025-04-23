import { Profile, Server } from '@aurora-launcher/core';
import { MutableRefObject, useEffect, useRef, useState } from 'react';

import If from '../../components/If';
import { useTitlebar } from '../../components/TitleBar/hooks';
import classes from './index.module.sass';
import { LoadProgress } from '../../../../common/types';
import { usePingServer } from '../../hooks/pingServer';
import { Button } from '../../../components/ui/button';
import { Progress } from '../../../components/ui/progress';

// TODO Refactoring scene
export default function ServerPanel() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [selectedProfile, setSelectedProfile] = useState({} as Profile);
    const [selectedServer, setSelectedServer] = useState({} as Server);
    const players = usePingServer(selectedServer);

    const [showConsole, setShowConsole] = useState(false);
    const [showProgress, setShowProgress] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);

    const consoleRef = useRef() as MutableRefObject<HTMLPreElement>;
    const progressLine = useRef() as MutableRefObject<HTMLDivElement>;
    const progressInfo = useRef() as MutableRefObject<HTMLDivElement>;

    const { showTitlebarBackBtn, hideTitlebarBackBtn } = useTitlebar();

    useEffect(() => {
        launcherAPI.scenes.serverPanel.getProfile().then(setSelectedProfile);
        launcherAPI.scenes.serverPanel.getServer().then(setSelectedServer);

        showTitlebarBackBtn();
    }, []);

    const startGame = () => {
        hideTitlebarBackBtn();
        setShowConsole(true);
        consoleRef.current?.replaceChildren();
        setGameStarted(true);
        launcherAPI.scenes.serverPanel.startGame(
            textToConsole,
            progress,
            stopGame,
        );
    };

    const stopGame = () => {
        setGameStarted(false);
        showTitlebarBackBtn();
        setProgressValue(0);
    };

    const textToConsole = (string: string) => {
        const consoleEl = consoleRef.current;
        if (!consoleEl) return;

        consoleEl.appendChild(document.createTextNode(string));
        consoleEl.scrollTop = consoleEl.scrollHeight;
    };

    const progress = ({ total, loaded, type }: LoadProgress) => {
        if (loaded < total) setShowProgress(true);
    
        const percent = Math.min(100, Math.max(0, (loaded / total) * 100)); // Ограничиваем от 0 до 100
        setProgressValue(percent); // Обновляем state progressValue
    
        if (progressLine.current) {
          progressLine.current.style.width = percent.toFixed(2) + '%';
        }
        setShowProgress(percent < 100);
    
        if (!progressInfo.current) return;
    
        if (type === 'count') {
          progressInfo.current.innerHTML = `Загружено ${loaded} из ${total}`;
        } else {
          progressInfo.current.innerHTML = `Загружено ${bytesToSize(
            loaded,
          )} из ${bytesToSize(total)}`;
        }
      };
    const [progressValue, setProgressValue] = useState(0);

    return (
        <div className="flex flex-col items-center justify-start py-4 gap-4">
            <img className='h-[70px]' src="../../../runtime/assets/images/title.png" alt="" />
            {/* <div className={classes.info}>
                <div className={classes.title}>{selectedServer.title}</div>
                <div className={classes.status}>
                    <div className={classes.gamers}>
                        Игроков
                        <br />
                        онлайн
                    </div>
                    <div className={classes.line}></div>
                    <div className={classes.count}>
                        {players.online}
                        <div className={classes.total}>из {players.max}</div>
                    </div>
                </div>
            </div>
            <div className={classes.content}>
                <If state={showProgress}>
                    <>
                        <div className={classes.progress}>
                            <div
                                className={classes['progress-line']}
                                ref={progressLine}
                            ></div>
                        </div>
                        <div
                            className={classes['progress-info']}
                            ref={progressInfo}
                        ></div>
                    </>
                </If>
                <If state={showConsole}>
                    <pre className={classes.console} ref={consoleRef}></pre>
                </If>
            </div> */}
            <If state={true}>
                    <div className='flex flex-col items-center gap-2'>
                    <Progress className='w-[500px] h-3.5 rounded-xl' value={progressValue} />
                        <div
                            className={classes['progress-info']}
                            ref={progressInfo}
                        />
                    </div>
                </If>
                <If state={true}>
                    <pre className="bg-accent w-screen max-w-screen p-1 overflow-auto h-[44vh]" ref={consoleRef}></pre>
                </If>
            
            {/* <div className='flex flex-col gap-10 items-center mt-10'>
                <div className="border border-border flex items-center justify-center px-4 py-2 rounded-xl gap-2 background-online-gradient w-min flex-nowrap text-nowrap">
                <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-green-500"></span>
                </span>
                    Онлайн: {players.online}
                </div>
                <Button variant={'default'} className='text-center h-[40px] w-[240px] text-lg' onClick={startGame} disabled={gameStarted}>Играть</Button>

            </div> */}
            {/* <div className={classes.buttons}>
                <button onClick={startGame} disabled={gameStarted}>
                    Играть
                </button>
            </div> */}
            <Button onClick={startGame} disabled={gameStarted} variant={'default'} className='text-center h-[40px] w-[240px] text-lg mt-2'>Играть</Button>

        </div>
    );
}

function bytesToSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB'];
    if (bytes === 0) return 'n/a';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i === 0) return `${bytes} ${sizes[i]}`;
    return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
}
