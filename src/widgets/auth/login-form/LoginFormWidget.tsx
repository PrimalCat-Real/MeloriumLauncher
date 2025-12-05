import LogoBrand from '@/components/header/LogoBrand'
import LogoText from '@/components/header/LogoText'
import LoginCardBg from '@/components/login/login-card-bg-'
import React from 'react'

const LoginFormWidget = () => {
  return (
    <>
      <LoginCardBg />
      <section className="z-10 flex flex-col items-center justify-center gap-4 px-6 py-4">
        <LogoBrand height={90} width={90} />
        <LogoText />
        <p className="text-center leading-5 mb-4 outline-btn-text-gradient">
          Пожалуйста, введите ваш логин и пароль, чтобы продолжить
        </p>
      </section>
    </>
  )
}

export default LoginFormWidget