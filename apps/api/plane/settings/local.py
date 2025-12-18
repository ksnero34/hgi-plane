"""Development settings"""

import os

from .common import *  # noqa

DEBUG = True

# Honor the 'X-Forwarded-Proto' header for request.is_secure()
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Debug Toolbar settings
INSTALLED_APPS += ("debug_toolbar",)  # noqa
MIDDLEWARE += ("debug_toolbar.middleware.DebugToolbarMiddleware",)  # noqa

DEBUG_TOOLBAR_PATCH_SETTINGS = False

# Only show emails in console don't send it to smtp
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,  # noqa
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

INTERNAL_IPS = ("127.0.0.1",)

MEDIA_URL = "/uploads/"
MEDIA_ROOT = os.path.join(BASE_DIR, "uploads")  # noqa

LOG_DIR = os.path.join(BASE_DIR, "logs")  # noqa

if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": True,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "fmt": "%(levelname)s %(asctime)s %(module)s %(name)s %(message)s",
        },
        "audit": {
            "format": "%(message)s",
        },
    },
    "handlers": {
        "console": {
            "level": "DEBUG",
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
        "audit_file": {
            "level": "INFO",
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": os.path.join(LOG_DIR, "audit.log"),
            "when": "midnight",
            "interval": 1,
            "backupCount": 30,
            "formatter": "audit",
            "encoding": "utf-8",
        }
    },
    "loggers": {
        "plane.api.request": {
            "level": "INFO",
            "handlers": ["console"],
            "propagate": False,
        },
        "plane.api": {"level": "INFO", "handlers": ["console"], "propagate": False},
        "plane.worker": {"level": "INFO", "handlers": ["console"], "propagate": False},
        "plane.exception": {
            "level": "ERROR",
            "handlers": ["console"],
            "propagate": False,
        },
        "plane.external": {
            "level": "INFO",
            "handlers": ["console"],
            "propagate": False,
        },
        "audit": {
            "handlers": ["audit_file"],
            "level": "INFO",
            "propagate": True,
        },
        "plane.mongo": {
            "level": "INFO",
            "handlers": ["console"],
            "propagate": False,
        },
        "plane.migrations": {
            "level": "INFO",
            "handlers": ["console"],
            "propagate": False,
        },
    },
}
