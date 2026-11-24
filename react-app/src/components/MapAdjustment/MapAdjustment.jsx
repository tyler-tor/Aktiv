import React from 'react'
import EditMapModal from './EditMapModal'
import DeleteMapModal from './DeleteMapModal'
import './MapAdjustment.css'

function MapAdjustment({route}) {
    return (
        <div className='ed-btn-container'>
            <EditMapModal route={route} />
            <DeleteMapModal routeId={route.id} />
        </div>
    )
}

export default MapAdjustment
