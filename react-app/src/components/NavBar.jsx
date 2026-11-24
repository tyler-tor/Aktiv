import React, { useEffect, useId, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, NavLink, useLocation } from 'react-router';
import { FiPlus, FiMenu, FiX } from 'react-icons/fi';
import LogoutButton from './auth/LogoutButton';
import Logo from './ui/Logo';
import { useUnits } from '../context/Units';
import './NavBar.css';

const NavBar = () => {
  const user = useSelector((state) => state.session.user);
  const { unit, toggleUnit } = useUnits();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const location = useLocation();

  // Close the phone menu after navigating and when Escape is pressed.
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className='navbar'>
      <div className='navbar__inner'>
        <Link to='/' className='navbar__logo' aria-label='Aktiv home'>
          <Logo />
        </Link>
        <button type='button' className='navbar__toggle icon-btn' aria-expanded={open} aria-controls={panelId}
          aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          {open ? <FiX aria-hidden='true' /> : <FiMenu aria-hidden='true' />}
        </button>
        <div id={panelId} className={`navbar__panel${open ? ' is-open' : ''}`}>
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
      </div>
    </header>
  );
};

export default NavBar;
