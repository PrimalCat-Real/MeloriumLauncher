import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

import If from '../If';
import classes from './index.module.sass';
import { titlebarBackBtn, titlebarTitle, titlebarUser } from './states';
import { Button } from '../../../components/ui/button';
import logo from "@/runtime/assets/images/logo.png"
export default function TitleBar() {
    const backBtn = useRecoilValue(titlebarBackBtn);
    const title = useRecoilValue(titlebarTitle);
    const user = useRecoilValue(titlebarUser);
    const navigate = useNavigate();

    function hide() {
        launcherAPI.window.hide();
    }
    function close() {
        launcherAPI.window.close();
    }
    function historyBack() {
        navigate(-1);
    }

    const location = useLocation();

    const handleModsButtonClick = () => {
        if (location.pathname === '/ModList') {
        navigate('/ServersList');
        } else {
        navigate('/ModList');
        }
    };

    return (
        <div className="grid grid-cols-3 w-full h-10 custom-purple-gradient items-center px-4 draggable">
            {/* Левая колонка - кнопка назад и заголовок */}
            <div className="flex items-center justify-start gap-4">
                <If state={backBtn.show}>
                    <button className={classes.back} onClick={historyBack}>
                        <svg width="24" height="24" viewBox="0 0 24 24">
                            <path
                                d="M18.84 10.92V12.92H6.84L12.34 18.42L10.92 19.84L3 11.92L10.92 4L12.34 5.42L6.84 10.92H18.84Z"
                                fill="white"
                            />
                        </svg>
                    </button>
                </If>
                <If state={title.show}>
                    <div className="flex items-center gap-2">
                        <img className="h-5" src={logo} alt="" />
                        <span className="font-bold text-lg">{title.text}</span>
                    </div>
                </If>
            </div>

            {/* Центральная колонка - пользователь (строго по центру) */}
            <div className="flex items-center justify-center">
                <If state={user.show}>
                    <div className={`flex items-center justify-center`}>
                        <svg
                            width="22px"
                            height="22px"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <circle
                                cx="12"
                                cy="9"
                                r="3"
                                stroke="#fff"
                                strokeWidth="1.5"
                            />
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="#fff"
                                strokeWidth="1.5"
                            />
                            <path
                                d="M17.9691 20C17.81 17.1085 16.9247 15 11.9999 15C7.07521 15 6.18991 17.1085 6.03076 20"
                                stroke="#fff"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className={`ml-2 font-sans`}>
                            {user.username}
                        </div>
                    </div>
                </If>
            </div>

            {/* Правая колонка - кнопки */}
            <div className="flex items-center justify-end gap-4">
                <If state={title.show}>
                    <Button 
                        onClick={handleModsButtonClick} 
                        className="h-6.5 w-16"
                    >
                        Моды
                    </Button>
                </If>
                <button className={`${classes.hide} no-drag`} onClick={hide}>
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path d="M19 13H5V11H19V13Z" fill="white" />
                    </svg>
                </button>
                <button className={`${classes.close} no-drag`} onClick={close}>
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path
                            d="M13.46 12L19 17.54V19H17.54L12 13.46L6.46 19H5V17.54L10.54 12L5 6.46V5H6.46L12 10.54L17.54 5H19V6.46L13.46 12Z"
                            fill="white"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}