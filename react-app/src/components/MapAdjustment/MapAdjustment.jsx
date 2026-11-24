import React from 'react'
import EditMapModal from './EditMapModal'
import DeleteMapModal from './DeleteMapModal'

function MapAdjustment({route}) {
    return (
        <div className='btn-row'>
            <EditMapModal route={route} />
            <DeleteMapModal routeId={route.id} />
        </div>
    )
}

export default MapAdjustment
