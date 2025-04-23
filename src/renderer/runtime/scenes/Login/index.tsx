import { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import logo from '../../assets/images/logo.png';
import { useModal } from '../../components/Modal/hooks';
import { useTitlebar } from '../../components/TitleBar/hooks';
import classes from './index.module.sass';
import { Button } from '../../../components/ui/button';

import LoginContainer from '../../assets/images/login_container.svg'
import LoginCard from '../../components/icons/LoginCard';
import { Input } from '../../../components/ui/input';

interface AuthData {
    [k: string]: string;
    login: string;
    password: string;
}

export default function Login() {
    const { showModal } = useModal();
    const { setTitlebarUserText, showTitlebarUser } = useTitlebar();
    const navigate = useNavigate();

    const auth = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const { login, password } = Object.fromEntries(formData) as AuthData;

        // Пример валидации
        if (login.length < 3) {
            return showModal(
                'Ошибка ввода',
                'Логин должен быть не менее 3-ёх символов',
            );
        }
        // if (password.length < 8) {
        //     return showModal(
        //         'Ошибка ввода',
        //         'Пароль должен быть не менее 8-ми символов'
        //     );
        // }

        let userData;
        try {
            userData = await launcherAPI.scenes.login.auth(login, password);
        } catch (error) {
            console.error(error);
            return showModal('Ошибка авторизации', (error as Error).message);
        }

        // Поддержка загрузки и отображения скина
        localStorage.setItem('userData', JSON.stringify(userData));

        setTitlebarUserText(userData.username);
        showTitlebarUser();
        navigate('ServersList');
    };

    return (
        <section className='flex items-center justify-center h-full w-full'>
            <div className="flex flex-col items-center justify-between w-[300px] h-[450px] relative p-1 gap-4 py-10">
            <img className='h-20' src={logo} />
            <LoginCard></LoginCard>
            <div className='space-y-1'>
            <h1 className='font-extrabold text-3xl font-sans tracking-wide text-center'>Melorium</h1>
            <p className='text-center'>
                Введите логин и пароль,
                <br />
                чтобы продолжить
            </p>
            </div>
            
            <form onSubmit={auth} className='z-10 flex flex-col gap-4 py-3 font-semibold placeholder:text-secondary-foreground'>
                <Input type="text" placeholder="Логин" name="login"></Input>
                <Input type="password" placeholder="Пароль" name="password"></Input>
                {/* <input type="text" placeholder="Логин" name="login" /> */}
                {/* <input type="password" placeholder="Пароль" name="password" /> */}
                <Button className='mt-6' variant={'default'}>Войти</Button>
            </form>
        </div>
        </section>
        
    );
}
