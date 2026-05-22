"""WSGI config for Peladinhas Sofredores."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "peladinha.settings")

application = get_wsgi_application()
