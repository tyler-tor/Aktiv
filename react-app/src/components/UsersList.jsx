import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router';
import { getAllUsers } from '../store/users';
import Avatar from './ui/Avatar';
import usePageTitle from '../hooks/usePageTitle';
import './UserRoutes/Routes.css';

// "People" page: everyone who has an account, linking to their profiles.
function UsersList() {
  const dispatch = useDispatch()
  const usersById = useSelector(state => state.users.users)
  usePageTitle('People');

  useEffect(() => {
    dispatch(getAllUsers())
  }, [dispatch]);

  const users = usersById ? Object.values(usersById) : null;

  return (
    <div className='page list-page'>
      <header className='list-page__head'>
        <div>
          <h1 className='list-page__title'>People</h1>
          <p className='page-lead'>Open a profile to see their activity and add them as a friend.</p>
        </div>
      </header>
      {!users && (
        <div className='list-grid' role='status'>
          <span className='sr-only'>Loading people</span>
          {[0, 1, 2, 3].map(i => <div key={i} className='skeleton' style={{ height: '5.5rem', borderRadius: 'var(--r-lg)' }} aria-hidden='true' />)}
        </div>
      )}
      {users && users.length === 0 && <div className='empty-state'><h2>No one here yet</h2></div>}
      {users && users.length > 0 && (
        <ul className='list-grid list-grid--people'>
          {users.map((user) => (
            <li key={user.id}>
              <Link to={`/users/${user.id}`} className='people-card'>
                <Avatar user={user} size='lg' />
                <span><strong>{user.firstName} {user.lastName}</strong><span>@{user.username}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default UsersList;
