import requests

base_url = "http://127.0.0.1:8000"
username = "admin@example.com"
password = "adminpass"

# 1. Get Token
token_url = f"{base_url}/users/token/"
response = requests.post(token_url, json={"username": username, "password": password})
if response.status_code != 200:
    print(f"Failed to get token: {response.status_code}")
    print(response.text)
    exit(1)

token = response.json()["access"]
print("Token obtained successfully.")

# 2. Get User Profile
profile_url = f"{base_url}/users/my-profile/"
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(profile_url, headers=headers)

if response.status_code == 200:
    print("Profile API verification successful!")
    print(response.json())
else:
    print(f"Failed to get profile: {response.status_code}")
    print(response.text)
