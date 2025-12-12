import os
import django
from django.urls import resolve, Resolver404

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

path = "/users/me/"
try:
    match = resolve(path)
    print(f"Path '{path}' resolves to:")
    print(f"  View Name: {match.view_name}")
    print(f"  Func: {match.func}")
    print(f"  Args: {match.args}")
    print(f"  Kwargs: {match.kwargs}")
except Resolver404:
    print(f"Path '{path}' DOES NOT RESOLVE (404)")
