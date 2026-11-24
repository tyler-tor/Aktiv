import React from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { logout } from '../../store/session';

const LogoutButton = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate();

  const onLogout = async () => {
    await dispatch(logout());
    navigate('/')
  };

  return <button onClick={onLogout} type='button' className='btn btn--ghost btn--sm'>Log out</button>;
};

export default LogoutButton;
