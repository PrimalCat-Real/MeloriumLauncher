import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import React from 'react'

const LoginForm = () => {
    return (
        <form
            onSubmit={ }
        >
            <Input
                value={ }
                onChange={ }
                className="w-full rounded-2xl text-center"
                placeholder="Логин"
                type="text"
            />
            <Input
                value={ }
                onChange={ }
                className="w-full rounded-2xl text-center"
                placeholder="Пароль"
                type="password"
            />
            <Button
                type="submit"
                disabled={ }
                className="w-full rounded-2xl"
            >
                {/* {isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <span>Войти</span>
              )} */}
            </Button>
        </form>
    )
}

export default LoginForm