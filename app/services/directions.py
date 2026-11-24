"""
Google Directions (web service) from the server.

When a route is created or edited, Flask asks Google once for the real path
between the two points and stores the result on the route: the encoded
polyline (the line to draw), the distance in metres and the time in seconds.
Pages then draw the stored line instead of every browser asking Google again
on every page view (which was billable, serial and blocked by CORS).

Needs GOOGLE_MAPS_SERVER_KEY: a *separate* key from the browser key, with
"Directions API" enabled and restricted by IP address (not by referrer). It is
only ever read on the server and never sent to the browser. Without the key
(or if Google answers with an error) nothing is stored and the app falls back
to drawing a straight line / asking the browser once.
"""
import json
import logging
import urllib.parse
import urllib.request

import click
from flask import current_app
from flask.cli import AppGroup

log = logging.getLogger(__name__)

DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json'
TIMEOUT_SECONDS = 5
# The route's traveling_mode is stored in the Maps JS spelling; the web
# service wants lower case. Anything else is not supported by the app.
MODES = {'WALKING': 'walking', 'BICYCLING': 'bicycling'}


def _http_get_json(url, timeout=TIMEOUT_SECONDS):
    """GET a URL and parse the JSON answer (a separate function so tests can replace it)."""
    with urllib.request.urlopen(url, timeout=timeout) as response:  # noqa: S310 (fixed https URL)
        return json.loads(response.read().decode('utf-8'))


def fetch_directions(start, end, mode, key=None):
    """
    Ask Google for the path from `start` to `end` (each a (lat, lng) pair).

    Returns {'polyline': str, 'distance_m': float, 'duration_s': int}, or None
    when there is no server key, the mode is unsupported, the request fails or
    Google finds no route. Never raises, never logs the key.
    """
    key = key or current_app.config.get('GOOGLE_MAPS_SERVER_KEY')
    google_mode = MODES.get(str(mode).upper())
    if not key or not google_mode:
        return None
    query = urllib.parse.urlencode({
        'origin': f'{start[0]},{start[1]}',
        'destination': f'{end[0]},{end[1]}',
        'mode': google_mode,
        'key': key,
    })
    try:
        data = _http_get_json(f'{DIRECTIONS_URL}?{query}')
        if data.get('status') != 'OK' or not data.get('routes'):
            log.warning('Directions lookup returned status %s', data.get('status'))
            return None
        route = data['routes'][0]
        legs = route.get('legs') or []
        return {
            'polyline': route['overview_polyline']['points'],
            'distance_m': float(sum(leg['distance']['value'] for leg in legs)),
            'duration_s': int(sum(leg['duration']['value'] for leg in legs)),
        }
    except Exception as error:  # network error, bad JSON, unexpected shape ...
        log.warning('Directions lookup failed: %s', type(error).__name__)
        return None


def apply_directions(route):
    """
    Fill route.encoded_polyline / distance_m / duration_s from Google.
    If the lookup fails the polyline is cleared (an old line would be wrong
    for new points) and the client-supplied distance stays.
    """
    result = fetch_directions((route.start_lat, route.start_lng),
                              (route.end_lat, route.end_lng), route.traveling_mode)
    if result is None:
        route.encoded_polyline = None
        return False
    route.encoded_polyline = result['polyline']
    route.distance_m = result['distance_m']
    route.duration_s = result['duration_s']
    return True


directions_commands = AppGroup('directions', help='Google Directions helpers.')


@directions_commands.command('backfill')
@click.option('--all', 'redo_all', is_flag=True, help='Also recompute routes that already have a polyline.')
def backfill(redo_all):
    """Store the polyline of every route that has none (needs GOOGLE_MAPS_SERVER_KEY)."""
    from app.models import Route, db
    if not current_app.config.get('GOOGLE_MAPS_SERVER_KEY'):
        raise click.ClickException('GOOGLE_MAPS_SERVER_KEY is not set.')
    stmt = db.select(Route)
    if not redo_all:
        stmt = stmt.where(Route.encoded_polyline.is_(None))
    done = failed = 0
    for route in db.session.scalars(stmt.order_by(Route.id)).all():
        if apply_directions(route):
            done += 1
        else:
            failed += 1
        db.session.commit()
    click.echo(f'Updated {done} route(s), {failed} without a result.')
