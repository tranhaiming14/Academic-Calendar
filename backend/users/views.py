from rest_framework import generics, status
from rest_framework.response import Response

from .models import StudentProfile
from .serializers import StudentProfileSerializer, UserSerializer
from .permissions import IsDAAOrAdminOrHasModelPerm
from rest_framework.permissions import IsAuthenticated

class UserProfileView(generics.RetrieveUpdateAPIView):
	"""Retrieve or update the current user's profile.
	Allows the authenticated user to view and edit their own `username`/`email`.
	"""
	serializer_class = UserSerializer
	permission_classes = [IsAuthenticated]

	def get_object(self):
		return self.request.user


class StudentProfileCreateView(generics.CreateAPIView):
	"""Create a StudentProfile. Only DAA, Admin or users with the
	`users.can_create_student` permission may create student profiles.
	"""
	queryset = StudentProfile.objects.all()
	serializer_class = StudentProfileSerializer
	permission_classes = (IsDAAOrAdminOrHasModelPerm,)

	def create(self, request, *args, **kwargs):
		return super().create(request, *args, **kwargs)

