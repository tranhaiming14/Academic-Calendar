import os
import django
from django.contrib.auth import authenticate

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
username = "testuser_distinct"
email = "login_test@example.com"
password = "testpassword123"

# Create user if not exists
if not User.objects.filter(username=username).exists():
    User.objects.create_user(username=username, email=email, password=password)
    print(f"User '{username}' created with email '{email}'.")
else:
    print(f"User '{username}' already exists.")

# Test authentication with email
user = authenticate(username=email, password=password)
if user:
    print(f"SUCCESS: Authenticated user '{user.username}' using email '{email}'.")
else:
    print(f"FAILURE: Could not authenticate using email '{email}'.")
