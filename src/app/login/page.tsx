'use client'
import LogoBrand from '@/components/header/LogoBrand'
import LogoText from '@/components/header/LogoText'
import LoginCardBg from '@/components/login/login-card-bg-'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/utils'
import { RootState } from '@/store/configureStore'
import { setCredentials, setUserData } from '@/store/slice/authSlice'
import { LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useSelector } from 'react-redux'
import { toast } from "sonner"
import axios from 'axios';
import { useMutation } from '@tanstack/react-query'
import ActiveEndpointSelector from '@/components/shared/ActiveEndpointSelector'
const LoginPage = () => {
  const router = useRouter()
  const dispatch = useDispatch()
  const { userLogin, userPassword } = useSelector((state: RootState) => state.authSlice)
  const [username, setUsername] = useState(userLogin)
  const [password, setPassword] = useState(userPassword)
  const [isInitialized, setIsInitialized] = useState(false)
  const [loading, setLoading] = useState(false)

  const activeEndPoint = useSelector((state: RootState) => state.settingsState.activeEndPoint)

  useEffect(() => {
    if (!isInitialized && userLogin) {
      setUsername(userLogin)
      setIsInitialized(true)
    }
    if (!isInitialized && userPassword) {
      setPassword(userPassword)
      setIsInitialized(true)
    }
  }, [userLogin, userPassword, isInitialized])
  
  
  type LoginInput = { login: string; password: string };
  type LoginRessult = {
    uuid: string;
    is_active: boolean;
    tokens: number;
  };

 const loginRequest = useCallback(
    async ({ login, password }: LoginInput): Promise<LoginRessult> => {
      const { data } = await axios.post(
        `${activeEndPoint}/login`,
        { login, password }
      )
      return data
    },
    [activeEndPoint]
  )

  const mutation = useMutation({ mutationFn: loginRequest, retry: false });

   const handleLogin = async () => {
    // setLoading(true)

    // if (username === 'test' && password === 'test') {
    //   dispatch(
    //     setUserData({
    //       userUuid: 'e8a18932-c201-493a-b1b0-85853c19fde6',
    //       authStatus: true,
    //       userLogin: username,
    //       userPassword: password,
    //       donateTokens: 99999
    //     })
    //   );
    //   toast.success('Вход выполнен успешно!', { description: 'Вы вошли как тестовый пользователь.' });
    //   // alert("login")
    //   // router.push('/')
    //   router.replace('/');
      
    //   return;
    // }

    mutation.mutate(
      { login: username, password },
      {
        onSuccess: (data) => {
          dispatch(
            setUserData({
              // userSessionToken: data.tokens.toString(),
              userUuid: data.uuid,
              authStatus: true,
              userLogin: username,
              userPassword: password,
              donateTokens: data.tokens
            })
          );
          
          router.replace('/');
        },
        onError: (err: any) => {
          toast.error('Ошибка входа', { description: err?.response?.data?.error });
        },
      }
    );
    
    // const res = await fetch('http://localhost:8000');
    // if (!res.ok) throw new Error('Network error');
    // return res.json();
    // try {
    //   const result = await useAuth(username, password)
    //   if (result.is_authenticated && result.accesstoken && result.uuid) {
    //     dispatch(setUserData({
    //       userSessionToken: result.accesstoken,
    //       userUuid: result.uuid,
    //       authStatus: true,
    //       userLogin: username,
    //       userPassword: password
    //     }))
    //     router.replace('/')
    //   } else {
    //     toast.error("Ошибка авторизации", {
    //       description: result.error || "Неизвестная ошибка",
    //     })
    //   }
    // } catch (err: any) {
    //   toast.error("Системная ошибка", {
    //     description: err?.message || String(err),
    //   })
    // } finally {
    //   setLoading(false)
    // }
  }

  const handleUsernameInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value)
  }
  const handlePasswordInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value)
  }

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleLogin();
    },
    [handleLogin]
  );
  return (
    <div className="relative min-h-full ">
        <form
          className="relative w-[300px] h-[450px] flex items-center justify-center flex-col top-1/2 left-1/2 -translate-x-1/2 translate-y-[15%]"
          onSubmit={handleFormSubmit}
        >
          <LoginCardBg />
          <div className="z-10 flex flex-col items-center justify-center gap-4 px-6 py-4">
            <LogoBrand height={90} width={90} />
            <LogoText />
            <p className="text-center leading-5 mb-4 outline-btn-text-gradient">
              Пожалуйста, введите ваш логин и пароль, чтобы продолжить
            </p>
            <Input
              value={username}
              onChange={handleUsernameInput}
              className="w-full rounded-2xl text-center"
              placeholder="Логин"
              type="text"
            />
            <Input
              value={password}
              onChange={handlePasswordInput}
              className="w-full rounded-2xl text-center"
              placeholder="Пароль"
              type="password"
            />
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-2xl"
            >
              {mutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <span>Войти</span>
              )}
            </Button>
          </div>
          <ActiveEndpointSelector />
        </form>

    </div>
      
  )
}

export default LoginPage