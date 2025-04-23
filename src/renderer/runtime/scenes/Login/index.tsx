import React, { FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';

import logo from '../../assets/images/logo.png';
import { useModal } from '../../components/Modal/hooks';
import { useTitlebar } from '../../components/TitleBar/hooks';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import LoginCard from '../../components/icons/LoginCard';

import { lastLoginState, lastPasswordState } from '../../state/auth';

interface AuthData {
  [k: string]: string;
  login: string;
  password: string;
}

export default function Login() {
  const { showModal } = useModal();
  const { setTitlebarUserText, showTitlebarUser } = useTitlebar();
  const navigate = useNavigate();
  const [login, setLogin] = useRecoilState(lastLoginState);
  const [password, setPassword] = useRecoilState(lastPasswordState);

  useEffect(() => {
    const storedLogin = localStorage.getItem('lastLogin');
    const storedPassword = localStorage.getItem('lastPassword');

    if (storedLogin) {
      setLogin(storedLogin);
    }
    if (storedPassword) {
      setPassword(storedPassword);
    }
  }, [setLogin, setPassword]);

  const auth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const { login: currentLogin, password: currentPassword } = Object.fromEntries(formData) as AuthData;

    setLogin(currentLogin);
    setPassword(currentPassword);
    localStorage.setItem('lastLogin', currentLogin);
    localStorage.setItem('lastPassword', currentPassword);

    if (login.length < 3) { // Використовуйте оновлений стан login
      return showModal(
        'Ошибка ввода',
        'Логин должен быть не менее 3-ёх символов',
      );
    }

    let userData;
    try {
      userData = await launcherAPI.scenes.login.auth(currentLogin, currentPassword);
    } catch (error) {
      console.error(error);
      return showModal('Ошибка авторизации', (error as Error).message);
    }

    localStorage.setItem('userData', JSON.stringify(userData));
    setTitlebarUserText(userData.username);
    showTitlebarUser();
    navigate('ServersList');
  };

  return (
    <section className='flex items-center justify-center h-full w-full'>
      <div className="flex flex-col items-center justify-between w-[300px] h-[450px] relative p-1 gap-4 py-10">
        <img className='h-20' src={logo} alt="Логотип" />
        <LoginCard />
        <div className='space-y-1'>
          <h1 className='font-extrabold text-3xl font-sans tracking-wide text-center'>Melorium</h1>
          <p className='text-center'>
            Введите логин и пароль,
            <br />
            чтобы продолжить
          </p>
        </div>

        <form onSubmit={auth} className='z-10 flex flex-col gap-4 py-3 font-semibold placeholder:text-secondary-foreground'>
          <Input
            value={login || ''}
            type="text"
            placeholder="Логин"
            name="login"
            onChange={(e) => setLogin(e.target.value)} // Додано обробник onChange
          />
          <Input
            value={password || ''} // Додано пропс value
            type="password"
            placeholder="Пароль"
            name="password"
            onChange={(e) => setPassword(e.target.value)} // Додано обробник onChange
          />
          <Button className='mt-6' variant={'default'}>Войти</Button>
        </form>
      </div>
    </section>
  );
}