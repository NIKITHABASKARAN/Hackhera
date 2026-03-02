import os

from pymongo import MongoClient


_mongo_client: MongoClient | None = None


def _get_mongo_uri() -> str:
    """
    Resolve the MongoDB URI from environment with a sensible default.
    """
    return os.getenv("MONGO_URI", "mongodb://localhost:27017/aletheia")


def get_client() -> MongoClient:
    """
    Return a singleton MongoClient instance.
    """
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(_get_mongo_uri())
    return _mongo_client


def get_db():
    """
    Return the default database for the configured Mongo URI.
    If the URI does not specify a database, fall back to 'aletheia'.
    """
    client = get_client()
    db = client.get_default_database()
    if db is None:
        return client["aletheia"]
    return db

