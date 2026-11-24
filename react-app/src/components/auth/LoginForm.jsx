import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, Navigate } from 'react-router';
import { login } from '../../store/session';
import ContourBackdrop from '../ui/ContourBackdrop';
import './AuthPages.css'

const LoginForm = () => {
  const [errors, setErrors] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const user = useSelector(state => state.session.user);
  const dispatch = useDispatch();

  const signIn = async (address, secret) => {
    setBusy(true);
    const data = await dispatch(login(address, secret));
    if (data) {
      setErrors(data);
      setBusy(false);
    }
  };

  const onLogin = (e) => {
    e.preventDefault();
    signIn(email, password);
  };

  const demoClick = (e) => {
    e.preventDefault();
    signIn('demo@aa.io', 'password');
  }

  if (user) {
    return <Navigate to='/' replace />;
  }

  return (
    <main className='auth'>
      <section className='auth__hero' aria-labelledby='auth-headline'>
        <ContourBackdrop />
        <div className='auth__hero-copy'>
          <h1 id='auth-headline' className='auth__headline'>Plan the route. Log the effort. Cheer each other on.</h1>
          <p className='auth__sub'>Drop two pins to save a walking or cycling route, record your workouts, and follow what your friends are up to.</p>
        </div>
      </section>
      <section className='auth__panel' aria-labelledby='login-title'>
        <form onSubmit={onLogin} className='form auth__form'>
          <h2 id='login-title'>Log in</h2>
          <div className='form-errors' role='alert'>
            {errors.map((error, ind) => (
              <p key={ind} className='form-error'>{error}</p>
            ))}
          </div>
          <div className='field'>
            <label htmlFor='login-email'>Email</label>
            <input id='login-email' name='email' type='email' autoComplete='email' required
              className='input' value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className='field'>
            <label htmlFor='login-password'>Password</label>
            <input id='login-password' name='password' type='password' autoComplete='current-password' required
              className='input' value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type='submit' className='btn btn--primary btn--block' disabled={busy}>
            {busy ? 'Logging in...' : 'Log in'}
          </button>
          <button type='button' className='btn btn--secondary btn--block' onClick={demoClick} disabled={busy}>
            Try the demo account
          </button>
          <p className='auth__switch'>New to Aktiv? <Link to='/sign-up'>Create an account</Link></p>
        </form>
      </section>
    </main>
  );
};

export default LoginForm;
