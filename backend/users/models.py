from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth import get_user_model
import logging
from datetime import date

logger = logging.getLogger(__name__)
class User(AbstractUser):
    ROLE_CHOICES = [
        ("student", "Student"),
        ("tutor", "Tutor"),
        ("academic_assistant", "Academic Assistant"),
        ("department_assistant", "Department Academic Assistant"),
        ("administrator", "Administrator"),
    ]

    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default="student")

    def __str__(self):
        return f"{self.username} ({self.role})"
# Major model moved to calendar_app.models
# Create your models here.
class StudentProfile(models.Model):
    # Make user optional at the DB/form level so admin can create a StudentProfile
    # and let the model's save() create the associated User if missing.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    email = models.EmailField(unique=True, default="john@doe.com")
    dob = models.DateField(verbose_name="date of birth")
    student_id = models.CharField(max_length=50, unique=True)
    # link student's major to Major model in calendar_app; allow null to ease migrations and optional students
    major = models.ForeignKey('calendar_app.Major', on_delete=models.SET_NULL, null=True, blank=True, related_name="students")
    year = models.PositiveSmallIntegerField()
    # whether the student is eligible to advance to the next year
    can_advance = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.user_id:  # If no user assigned yet
            # Username should be the student's name and email the student's email
            username = self.name

            # Password: DOB in ddmmyy format + student_id
            try:
                dob_str = self.dob.strftime('%d%m%y')
            except Exception:
                dob_str = str(self.dob)
            password = f"{dob_str}{self.student_id}"

            # Create the user (use get_user_model for safety)
            user_model = get_user_model()
            user = user_model.objects.create_user(username=username, email=self.email, password=password, role='student')
            self.user = user
            
            # Log the created credentials
            logger.info(f"Created user for student {self.name}: username='{username}', password='{password}'")
        
        super().save(*args, **kwargs)
    def __str__(self):
        return f"{self.student_id} - {self.name}"


    def delete(self, *args, **kwargs):
        # Delete the associated user when student profile is deleted
        if self.user:
            self.user.delete()
        super().delete(*args, **kwargs)


class TutorProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tutor_profile")
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200)
    dob = models.DateField(verbose_name="date of birth")
    tutor_id = models.CharField(max_length=50, unique=True)
    courses = models.ManyToManyField('calendar_app.Course', related_name="tutors", blank=True)
    def delete(self, *args, **kwargs):
        # Delete the associated user when tutor profile is deleted
        if self.user:
            self.user.delete()
        super().delete(*args, **kwargs)

    def __str__(self):
        return self.name

class AcademicAssistantProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="academic_assistant_profile")
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200)
    assistant_id = models.CharField(max_length=50, unique=True)

    def delete(self, *args, **kwargs):
        # Delete the associated user when academic assistant profile is deleted
        if self.user:
            self.user.delete()
        super().delete(*args, **kwargs)

    def __str__(self):
        return self.name
    
class DepartmentAcademicAssistantProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="department_academic_assistant_profile")
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200)
    dassistant_id = models.CharField(max_length=50, unique=True)

    def delete(self, *args, **kwargs):
        # Delete the associated user when department academic assistant profile is deleted
        if self.user:
            self.user.delete()
        super().delete(*args, **kwargs)
    def __str__(self):
        return self.name
    
class AdministratorProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="administrator_profile")
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200)
    admin_id = models.CharField(max_length=50, unique=True)

    def delete(self, *args, **kwargs):
        # Delete the associated user when administrator profile is deleted
        if self.user:
            self.user.delete()
        super().delete(*args, **kwargs)

    def __str__(self):
        return self.name