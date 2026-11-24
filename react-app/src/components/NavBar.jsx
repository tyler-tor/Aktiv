
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { NavLink } from 'react-router';
import LogoutButton from './auth/LogoutButton';
import { useUnits } from '../context/Units';
import './NavBar.css'

const NavBar = () => {

  const [click, setClick] = useState(false);
  const [button, setButton] = useState(true);
  const user = useSelector((state) => state.session.user)
  const { unit, toggleUnit } = useUnits();

  const handleClick = () => setClick(!click);
  const closeMobileMenu = () => setClick(false);

  const showButton = () => {
    if (window.innerWidth <= 960) {
      setButton(false);
    } else {
      setButton(true);
    }
  };

  useEffect(() => {
    showButton();
  }, []);

  window.addEventListener('resize', showButton);

  return (
    <>
      <nav className='navbar'>
        <div className='navbar-container'>
          <NavLink to='/' className='navbar-logo' onClick={closeMobileMenu}>
            AKTIV <i className="fab fa-strava"></i>
          </NavLink>
          <div className='menu-icon' onClick={handleClick}>
            <i className={click ? 'fas fa-times' : 'fas fa-bars'} />
          </div>
          {!user ? (
            <ul className={click ? 'nav-menu active' : 'nav-menu'}>
              <li className='nav-item'>
                <NavLink to='/' end
                  className='nav-links' onClick={closeMobileMenu}>
                  Login
                </NavLink>
              </li>
              <li className='nav-item'>
                <NavLink to='/sign-up' end
                  className='nav-links' onClick={closeMobileMenu}>
                  Sign Up
                </NavLink>
              </li>
            </ul>
          ) : (
            <>
              <ul className={click ? 'nav-menu active' : 'nav-menu'}>
                <li className='nav-item'>
                  <NavLink to='/' end
                    className='nav-links' onClick={closeMobileMenu}>
                    Map
                  </NavLink>
                </li>
                <li className='nav-item'>
                  <NavLink to='/routes' end
                    className='nav-links' onClick={closeMobileMenu}>
                    Routes
                  </NavLink>
                </li>
                <li className='nav-item'>
                  <NavLink to='/activity' end
                    className='nav-links' onClick={closeMobileMenu}>
                    Activity
                  </NavLink>
                </li>
                <li className='nav-item'>
                  <NavLink to='/users' end
                    className='nav-links' onClick={closeMobileMenu}>
                    Users
                  </NavLink>
                </li>
                <li className='nav-item'>
                  <NavLink to='/newRoute' end
                    className='nav-links' onClick={closeMobileMenu}>
                    + Route
                  </NavLink>
                </li>
                <li className='nav-item'>
                  <NavLink to='/newWorkout' end
                    className='nav-links' onClick={closeMobileMenu}>
                    + Workout
                  </NavLink>
                </li>
                <li className='nav-item'>
                  <NavLink to='/sign-up' className='nav-links-mobile' onClick={closeMobileMenu}>
                    Sign Up
                  </NavLink>
                </li>
              </ul>
              <button type='button' className='btn btn--outline btn--medium unit-toggle' onClick={toggleUnit}
                aria-label={`Distances are shown in ${unit === 'km' ? 'kilometres' : 'miles'}. Switch to ${unit === 'km' ? 'miles' : 'kilometres'}`}>
                {unit}
              </button>
              {button && <LogoutButton buttonStyle='btn--outline' />}
            </>
          )}
        </div>
      </nav>
    </>
  );
}

export default NavBar;
