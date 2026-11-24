import { createSlice } from '@reduxjs/toolkit';
import { csrfFetch } from './csrf';
const routesSlice = createSlice({
    name: 'routes',
    initialState: { currentRoute: null, routes: null },
    reducers: {
        // Loading all routes replaces the list and clears currentRoute.
        getRoutes(state, action) {
            state.currentRoute = null;
            state.routes = {};
            action.payload.forEach((route) => {
                state.routes[route.id] = route;
            });
        },
        getCurrentRouteAction(state, action) {
            state.currentRoute = action.payload;
        },
        addRouteAction(state, action) {
            state.routes[action.payload.id] = action.payload;
        },
        updateRouteAction(state, action) {
            state.currentRoute = action.payload;
            state.routes[action.payload.id] = action.payload;
        },
        deleteRouteAction(state, action) {
            delete state.routes[action.payload];
        },
    },
});

const { getRoutes, getCurrentRouteAction, addRouteAction, updateRouteAction, deleteRouteAction } = routesSlice.actions;

export const getCurrentRoute = (routeId) => async (dispatch) => {
    const res = await csrfFetch(`/api/routes/${routeId}`)

    if (res.ok) {
        const data = await res.json();
        dispatch(getCurrentRouteAction(data))
        return data
    }
}

export const getAllRoutes = () => async (dispatch) => {
    const response = await csrfFetch('/api/routes/');

    if (response.ok) {
        const data = await response.json();
        dispatch(getRoutes(data.routes));
        return data
    };
    return response
}

export const addRoute = (route) => async (dispatch) => {
    const response = await csrfFetch('/api/routes/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...route
        })
    });
    if (response.ok) {
        const newRoute = await response.json();
        dispatch(addRouteAction(newRoute));
    } else if (response.status < 500) {
        const data = await response.json();
        if (data.errors) {
            return data.errors;
        }
    } else {
        return ['An error occurred. Please try again.'];
    }
}

export const updateRoute = (route) => async (dispatch) => {
    const response = await csrfFetch(`/api/routes/${route.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: route.title,
            description: route.description,
            start_lat: route.start_lat,
            start_lng: route.start_lng,
            end_lat: route.end_lat,
            end_lng: route.end_lng,
            traveling_mode: route.traveling_mode,
            distance_m: route.distance_m,
            duration_s: route.duration_s,
            image_url: route.image_url
        })
    });
    if (response.ok) {
        const update = await response.json();
        dispatch(updateRouteAction(update));
    } else if (response.status < 500) {
        const data = await response.json();

        if (data.errors) {
            return data.errors
        };
    } else {
        return ['An error occurred. Please try again.'];
    }
};

export const deleteRoute = (id) => async (disptch) => {
    const response = await csrfFetch(`/api/routes/${id}`, {
        method: 'DELETE'
    });

    if (response.ok) {
        await response.json();
        disptch(deleteRouteAction(id));
    };
    return response
}


export default routesSlice.reducer;
