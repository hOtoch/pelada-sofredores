"""ASGI config for Peladinhas Sofredores."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "peladinha.settings")

application = get_asgi_application()
