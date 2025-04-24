import { Server } from '@aurora-launcher/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ServerButton } from '../../components/ServerButton';
import SkinView from '../../components/SkinView';
import classes from './index.module.sass';
import { useTitlebar } from '../../components/TitleBar/hooks';
import { Button } from '../../../components/ui/button';
import { usePingServer } from '../../hooks/pingServer';
import titleImg from '@/assets/images/title.png';

import { api, initApiConfig } from '../../../../../config'


export default function ServersList() {
    const { hideTitlebarBackBtn } = useTitlebar();
    hideTitlebarBackBtn();
    const [apiResult, setApiResult] = useState<any>("");
    

    const [servers, setServers] = useState<Server[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        launcherAPI.scenes.serversList.getServers().then(setServers);
    }, []);

    // useEffect(() => {
    //     const fetchApiConfig = async () => {
    //         const result = await initApiConfig();
    //         setApiResult(result);
    //       };
    //       fetchApiConfig()
    //   }, []); 

    const selectServer = async (server: Server) => {
        
        await launcherAPI.scenes.serversList.getServers();
        await launcherAPI.scenes.serversList.selectServer(server);
        
        console.log(JSON.stringify(launcherAPI.scenes.serverPanel.getProfile, null, 2));
        console.log(JSON.stringify(launcherAPI.scenes.serverPanel.getServer, null, 2));
        navigate('/ServerPanel');
    };
    const players = usePingServer({
        ip: "65.109.31.100",
        port: 25565,
        title: "Melorium",
        profileUUID: ""
    }
    );

    return (
        // <div className={classes.window}>
        //     <div className={classes.skinView}>
        //         <SkinView />
        //     </div>
        //     <div className={classes.serverList}>
                // {servers.map((server, i) => (
                //     <ServerButton
                //         key={i}
                //         server={server}
                //         onClick={() => selectServer(server)}
                //     />
                // ))}
        //     </div>
        // </div>
        <div className="flex flex-col items-center justify-start py-4">
            <div className='absolute right-5 bottom-5 flex flex-col'>
                <h2>{apiResult}</h2>
                {/* <h2>{api.web}</h2> */}
                {/* <Button onClick={() => {navigate('/ServerPanel')}}>Next</Button> */}
                {servers.map((server, i) => (
                    <h2>{server.title || "None"}</h2>
                ))}
            </div>
            <img className='h-[220px]' src={titleImg} alt="" />
            <p className='text-center font-sans text-xl font-semibold uppercase'>РАСКРОЙ ВСЕ ТАЙНЫ<br></br>ЗАГАДОЧНОГО КОРОЛЕВСТВА!</p>
            <div className='flex flex-col gap-10 items-center mt-10'>
                <div className="border border-border flex items-center justify-center px-4 py-2 rounded-xl gap-2 background-online-gradient w-min flex-nowrap text-nowrap">
                <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-green-500"></span>
                </span>
                    Онлайн: {players?.online}
                </div>
                <Button onClick={() => selectServer(servers[0])} variant={'default'} className='text-center h-[40px] w-[240px] text-lg'>Играть</Button>

            </div>
            {/* <div className={classes.buttons}>
                <button onClick={startGame} disabled={gameStarted}>
                    Играть
                </button>
            </div> */}
        </div>
    );
}
