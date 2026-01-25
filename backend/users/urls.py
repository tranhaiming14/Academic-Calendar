from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import StudentProfileCreateView, UserProfileView, StudentImportView
from .views import StudentListView, MajorListView, BulkPromoteView, StaffListView, StaffCreateView

print("LOADING USERS URLS MODULE")

urlpatterns = [
    # JWT Token endpoints
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # User Profile endpoint
    path("my-profile/", UserProfileView.as_view(), name="user_profile"),
    # Student creation endpoint
    path("create-student/", StudentProfileCreateView.as_view(), name="create-student"),
    # Excel import endpoint for DAA/admin
    path("import-students/", StudentImportView.as_view(), name="import-students"),
    path("students/", StudentListView.as_view(), name="student-list"),
    path("majors/", MajorListView.as_view(), name="major-list"),
    path("students/bulk-promote/", BulkPromoteView.as_view(), name="students-bulk-promote"),
    # Staff management endpoints
    path("staff/", StaffListView.as_view(), name="staff-list"),
    path("create-staff/", StaffCreateView.as_view(), name="create-staff"),
]
