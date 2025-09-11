from typing import Optional
from functools import lru_cache

from elasticsearch import Elasticsearch, AsyncElasticsearch  # type: ignore
from app.core.config import settings


@lru_cache()
def get_es_client() -> Elasticsearch:
    """Return a singleton Elasticsearch client configured from Settings."""
    kwargs = {
        "basic_auth": (settings.es_username, settings.es_password) if settings.es_username else None,
        "verify_certs": settings.es_verify_certs,
    }
    if settings.es_verify_certs and settings.es_ca_certs:
        kwargs["ca_certs"] = settings.es_ca_certs

    # Remove None values
    kwargs = {k: v for k, v in kwargs.items() if v is not None}

    return Elasticsearch(settings.es_url, **kwargs, request_timeout=settings.es_request_timeout)
