import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux'
import { Link, useNavigate, Navigate } from 'react-router';
import { signUp, authenticate } from '../../store/session';
import { uploadImage, setProfilePicture } from '../../store/uploads';
import ImageUploadComponent from '../ImageUploadComponenet';
import ContourBackdrop from '../ui/ContourBackdrop';
import './AuthPages.css'

const SignUpForm = () => {
  const [errors, setErrors] = useState([]);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [pictureFile, setPictureFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const user = useSelector(state => state.session.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const onSignUp = async (e) => {
    e.preventDefault();
    if (password !== repeatPassword) {
      setErrors(['Passwords do not match.']);
      return;
    }
    setBusy(true);
    const data = await dispatch(signUp(username, email, password, '', firstName, lastName));
    if (data) {
      setErrors(data)
      setBusy(false);
    } else {
      // Uploads require a logged-in user, so the picture is uploaded only
      // after the account exists. If it fails the default avatar is kept.
      if (pictureFile) {
        const result = await uploadImage(pictureFile);
        if (result.url && await setProfilePicture(result.url)) {
          await dispatch(authenticate());
        }
      }
      navigate('/')
    }
  };

  if (user) {
    return <Navigate to='/' replace />;
  }

  return (
    <main className='auth'>
      <section className='auth__hero' aria-labelledby='signup-headline'>
        <ContourBackdrop />
        <div className='auth__hero-copy'>
          <h1 id='signup-headline' className='auth__headline'>Make your first route in two clicks.</h1>
          <p className='auth__sub'>Create an account to save routes, log workouts and see what your friends are doing.</p>
        </div>
      </section>
      <section className='auth__panel' aria-labelledby='signup-title'>
        <form onSubmit={onSignUp} className='form auth__form auth__form--wide'>
          <h2 id='signup-title'>Create your account</h2>
          <div className='form-errors' role='alert'>
            {errors.map((error, ind) => (
              <p key={ind} className='form-error'>{error}</p>
            ))}
          </div>
          <div className='field'>
            <span className='field-label' id='signup-picture-label'>Profile picture (optional)</span>
            <ImageUploadComponent onFileSelected={setPictureFile} labelledBy='signup-picture-label' />
          </div>
          <div className='field-row'>
            <div className='field'>
              <label htmlFor='su-first'>First name</label>
              <input id='su-first' type='text' name='firstName' autoComplete='given-name' required className='input'
                value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className='field'>
              <label htmlFor='su-last'>Last name</label>
              <input id='su-last' type='text' name='lastName' autoComplete='family-name' required className='input'
                value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className='field'>
            <label htmlFor='su-username'>Username</label>
            <input id='su-username' type='text' name='username' autoComplete='username' required className='input'
              value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className='field'>
            <label htmlFor='su-email'>Email</label>
            <input id='su-email' type='email' name='email' autoComplete='email' required className='input'
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className='field-row'>
            <div className='field'>
              <label htmlFor='su-password'>Password</label>
              <input id='su-password' type='password' name='password' autoComplete='new-password' required minLength={8}
                className='input' aria-describedby='su-password-hint'
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <span className='field-hint' id='su-password-hint'>At least 8 characters.</span>
            </div>
            <div className='field'>
              <label htmlFor='su-repeat'>Repeat password</label>
              <input id='su-repeat' type='password' name='repeat_password' autoComplete='new-password' required
                className='input' value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} />
            </div>
          </div>
          <button type='submit' className='btn btn--primary btn--block' disabled={busy}>
            {busy ? 'Creating account...' : 'Create account'}
          </button>
          <p className='auth__switch'>Already have an account? <Link to='/'>Log in</Link></p>
        </form>
      </section>
    </main>
  );
};

export default SignUpForm;
