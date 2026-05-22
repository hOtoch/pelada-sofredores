#!/usr/bin/env python
"""Entrypoint do projeto Peladinhas Sofredores."""
import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "peladinha.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Não foi possível importar Django. Verifique se ele está instalado."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
