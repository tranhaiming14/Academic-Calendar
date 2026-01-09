from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()
class Major(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.name


class Course(models.Model):
    name = models.CharField(max_length=255)
    year = models.IntegerField(default=1)
    major = models.ForeignKey(Major, on_delete=models.SET_NULL, null=True, blank=True)
class Room(models.Model):
    name = models.CharField(max_length=255)


class ScheduledEvent(models.Model):
    EVENT_TYPES = [
        ("lecture", "Lecture"),
        ("labwork", "Labwork"),
        ("exam", "Exam"),
    ]
    title = models.CharField(max_length=255, default="New Event")
    date = models.DateField()
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    tutor = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()

    room = models.ForeignKey(Room, on_delete=models.CASCADE)

    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)

    status = models.CharField(max_length=20, default="pending")  # pending / approved / rejected

    def __str__(self):
        return f"{self.course.name} - {self.event_type}"


class AuditLog(models.Model):
    ACTIONS = [
        ("createEvent", "Create Event"),
        ("approveEvent", "Approve Event"),
        ("createStudent", "Create Student"),
        ("promoteStudent", "Promote Student"),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=30, choices=ACTIONS)
    # link to event or student depending on action
    event = models.ForeignKey(ScheduledEvent, on_delete=models.CASCADE, null=True, blank=True)
    student = models.ForeignKey('users.StudentProfile', on_delete=models.CASCADE, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    # optional free-text notes to record aggregate counts or details
    notes = models.TextField(null=True, blank=True)

    def __str__(self):
        target = self.event or self.student
        return f"{self.user.username} {self.action} {target}" 
