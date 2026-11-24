import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router';
import { getAllRoutes } from '../../store/routes';
import { useUnits } from '../../context/Units';
import { formatDate } from '../../utils/format';
import './Routes.css';

// "Routes" page: every route in the app, newest first, as a list of links.
function Routes() {
    const dispatch = useDispatch();
    const routesById = useSelector(state => state.routes.routes);
    const { distance } = useUnits();

    useEffect(() => {
        dispatch(getAllRoutes());
    }, [dispatch]);

    // null = still loading (before the first answer arrives)
    if (!routesById) {
        return <p className='list-page-status' role='status'>Loading routes...</p>;
    }

    const routes = Object.values(routesById).sort((a, b) => b.id - a.id);

    return (
        <main className='list-page'>
            <h1 className='list-page-title'>Routes</h1>
            {routes.length === 0 ? (
                <p className='list-page-status'>No routes yet. <NavLink to='/newRoute'>Add the first one</NavLink>.</p>
            ) : (
                <ul className='list-page-list'>
                    {routes.map(route => (
                        <li key={route.id} className='list-page-item'>
                            <NavLink to={`/routes/${route.id}`} className='list-page-link'>{route.title}</NavLink>
                            <span className='list-page-meta'>
                                {distance(route.distanceM)} · {route.travelMode.toLowerCase()} · by {route.ownerInfo.username} · {formatDate(route.createdAt)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}

export default Routes;
