"""Production is API-only; local development can still serve the React build."""
from app import create_app


def test_production_does_not_serve_the_frontend(prod_env):
    app = create_app('production')
    client = app.test_client()
    assert app.config['SERVE_FRONTEND'] is False
    assert client.get('/api/health').get_json() == {'status': 'ok'}
    # No catch-all route: the site comes from S3/CloudFront, not from Flask.
    assert client.get('/').status_code == 404
    assert client.get('/routes/3').status_code == 404
    assert 'react_root' not in app.view_functions


def test_production_can_opt_back_in(prod_env):
    prod_env.setenv('SERVE_FRONTEND', 'true')
    assert create_app('production').config['SERVE_FRONTEND'] is True


def test_development_serves_the_frontend(tmp_path, monkeypatch):
    monkeypatch.delenv('SERVE_FRONTEND', raising=False)
    monkeypatch.setenv('DATABASE_URL', 'sqlite://')
    monkeypatch.setenv('SECRET_KEY', 'dev-test-secret')
    (tmp_path / 'index.html').write_text('<!doctype html><title>Aktiv</title>')
    (tmp_path / 'assets').mkdir()
    (tmp_path / 'assets' / 'index-abc.js').write_text('console.log(1)')
    app = create_app('development')
    app.config['FRONTEND_DIST'] = str(tmp_path)
    client = app.test_client()
    page = client.get('/routes/3')
    assert page.status_code == 200 and b'Aktiv' in page.data
    assert page.headers['Cache-Control'] == 'no-cache'
    asset = client.get('/assets/index-abc.js')
    assert asset.status_code == 200
    assert 'immutable' in asset.headers['Cache-Control']
    # A missing file is a 404, not the page.
    assert client.get('/assets/old-123.js').status_code == 404


def test_unknown_api_urls_are_json_404s(client):
    response = client.get('/api/nope')
    assert response.status_code == 404
    assert response.is_json and 'errors' in response.get_json()


def test_wrong_method_is_json(client):
    response = client.delete('/api/health')
    assert response.status_code == 405
    assert response.is_json
