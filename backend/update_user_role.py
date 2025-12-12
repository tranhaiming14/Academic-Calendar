import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
username = "admin@example.com"

try:
    user = User.objects.get(username=username)
    user.role = "administrator"
    user.save()
    print(f"User '{username}' role updated to 'administrator'.")
except User.DoesNotExist:
    print(f"User '{username}' not found.")
