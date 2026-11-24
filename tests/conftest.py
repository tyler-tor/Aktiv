"""Shared pytest fixtures.

Every test gets a fresh app built by the factory with the testing config
(in-memory SQLite, CSRF off) and empty tables.
"""
import pytest

from app import create_app
from app.models import db, User


@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def prod_env(monkeypatch):
    """The variables production refuses to start without (dummy values)."""
    monkeypatch.setenv('SECRET_KEY', 'test-only-secret-for-production-config')
    monkeypatch.setenv('DATABASE_URL', 'sqlite://')
    return monkeypatch


def make_user(username='runner', email='runner@example.com', password='password'):
    user = User(username=username, email=email, password=password,
                first_name='Test', last_name='User')
    db.session.add(user)
    db.session.commit()
    return user


def login(client, email='runner@example.com', password='password'):
    response = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert response.status_code == 200, response.get_json()
    return response
