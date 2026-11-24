import React from 'react'
import { FiGithub, FiLinkedin } from 'react-icons/fi'
import Logo from './ui/Logo'
import './Footer.css'

function Footer() {
  return (
    <footer className='footer'>
      <div className='footer__inner'>
        <Logo />
        <p className='footer__text'>Plan routes, log workouts, cheer on your friends.</p>
        <div className='footer__links'>
          <a href='https://www.linkedin.com/in/derek-torrero-02823018a/' target='_blank' rel='noreferrer'
            className='icon-btn' aria-label='LinkedIn (opens in a new tab)'>
            <FiLinkedin aria-hidden='true' />
          </a>
          <a href='https://github.com/tyler-tor' target='_blank' rel='noreferrer'
            className='icon-btn' aria-label='GitHub (opens in a new tab)'>
            <FiGithub aria-hidden='true' />
          </a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
