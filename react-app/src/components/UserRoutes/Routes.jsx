import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router';
import { FiMap } from 'react-icons/fi';
import { getAllRoutes } from '../../store/routes';
import ActivityCard from '../ui/ActivityCard';
import usePageTitle from '../../hooks/usePageTitle';
import './Routes.css';

// "Routes" page: every route in the app, newest first, as a grid of cards.
function Routes() {
    const dispatch = useDispatch();
    const routesById = useSelector(state => state.routes.routes);
    const [failed, setFailed] = useState(false);
    usePageTitle('Routes');

    useEffect(() => {
        Promise.resolve(dispatch(getAllRoutes())).catch(() => setFailed(true));
    }, [dispatch]);

    const routes = routesById ? Object.values(routesById).sort((a, b) => b.id - a.id) : null;

    return (
        <main className='page list-page'>
            <header className='list-page__head'>
                <div>
                    <h1 className='list-page__title'>Routes</h1>
                    <p className='page-lead'>Every route shared on Aktiv, newest first.</p>
                </div>
                <Link to='/newRoute' className='btn btn--primary'>Plan a route</Link>
            </header>
            {failed && <div className='empty-state' role='alert'><h2>Could not load routes</h2><p>Reload the page to try again.</p></div>}
            {!routes && !failed && (
                <div className='list-grid' role='status'>
                    <span className='sr-only'>Loading routes</span>
                    {[0, 1, 2].map(i => <div key={i} className='skeleton list-grid__skeleton' aria-hidden='true' />)}
                </div>
            )}
            {routes && routes.length === 0 && (
                <div className='empty-state'>
                    <FiMap size={32} aria-hidden='true' />
                    <h2>No routes yet</h2>
                    <p>Drop a start and a finish pin on the map to save the first one.</p>
                    <Link to='/newRoute' className='btn btn--primary btn--sm'>Plan a route</Link>
                </div>
            )}
            {routes && routes.length > 0 && (
                <ul className='list-grid'>
                    {routes.map(route => (
                        <li key={route.id}><ActivityCard activity={route} kind='route' /></li>
                    ))}
                </ul>
            )}
        </main>
    );
}

export default Routes;
