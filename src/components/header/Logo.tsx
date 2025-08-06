import React from 'react'
import LogoText from './LogoText'
import LogoBrand from './LogoBrand'

const Logo = () => {
  return (
    <div className='flex items-center justify-center gap-x-4'>
        <LogoBrand></LogoBrand>
        <LogoText></LogoText>
    </div>
  )
}

export default Logo