import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { NavLink } from 'react-router';
import { getAllUsers } from '../store/users';
import './UserRoutes/Routes.css';

// "Athletes" page: everyone who has an account, linking to their profiles.
function UsersList() {
  const dispatch = useDispatch()
  const usersById = useSelector(state => state.users.users)

  useEffect(() => {
    dispatch(getAllUsers())
  }, [dispatch]);

  // null = still loading
  if (!usersById) {
    return <p className='list-page-status' role='status'>Loading users...</p>;
  }

  const users = Object.values(usersById);

  return (
    <main className='list-page'>
      <h1 className='list-page-title'>Users</h1>
      <ul className='list-page-list'>
        {users.map((user) => (
          <li key={user.id} className='list-page-item'>
            <NavLink to={`/users/${user.id}`} className='list-page-link'>{user.username}</NavLink>
            <span className='list-page-meta'>{user.firstName} {user.lastName}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default UsersList;
