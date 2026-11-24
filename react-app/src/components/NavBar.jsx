import React from 'react';
import { useSelector } from 'react-redux';
import { Link, NavLink } from 'react-router';
import { FiPlus } from 'react-icons/fi';
import LogoutButton from './auth/LogoutButton';
import Logo from './ui/Logo';
import { useUnits } from '../context/Units';
import './NavBar.css';

const NavBar = () => {
  const user = useSelector((state) => state.session.user);
  const { unit, toggleUnit } = useUnits();

  return (
    <header className='navbar'>
      <div className='navbar__inner'>
        <Link to='/' className='navbar__logo' aria-label='Aktiv home'>
          <Logo />
        </Link>
        {!user ? (
          <nav className='navbar__menu' aria-label='Main'>
            <NavLink to='/' end className='navbar__link'>Log in</NavLink>
            <NavLink to='/sign-up' className='btn btn--primary btn--sm'>Sign up</NavLink>
          </nav>
        ) : (
          <>
            <nav className='navbar__menu' aria-label='Main'>
              <NavLink to='/' end className='navbar__link'>Map</NavLink>
              <NavLink to='/routes' className='navbar__link'>Routes</NavLink>
              <NavLink to='/activity' className='navbar__link'>Activity</NavLink>
              <NavLink to='/users' className='navbar__link'>People</NavLink>
            </nav>
            <div className='navbar__actions'>
              <NavLink to='/newRoute' className='btn btn--primary btn--sm'><FiPlus aria-hidden='true' />Route</NavLink>
              <NavLink to='/newWorkout' className='btn btn--secondary btn--sm'><FiPlus aria-hidden='true' />Workout</NavLink>
              <button type='button' className='btn btn--ghost btn--sm unit-toggle' onClick={toggleUnit}
                aria-label={`Distances are shown in ${unit === 'km' ? 'kilometres' : 'miles'}. Switch to ${unit === 'km' ? 'miles' : 'kilometres'}`}>
                {unit}
              </button>
              <LogoutButton />
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export default NavBar;
