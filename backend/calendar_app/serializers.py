from rest_framework import serializers
from .models import ScheduledEvent, Course, Room, AuditLog
from django.contrib.auth import get_user_model

User = get_user_model()

class ScheduledEventSerializer(serializers.ModelSerializer):
    course_name = serializers.SerializerMethodField(read_only=True)
    room_name = serializers.SerializerMethodField(read_only=True)
    tutor_name = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = ScheduledEvent
        # expose all model fields; SerializerMethodFields are added automatically
        fields = "__all__"
        read_only_fields = ["status"]
    
    def validate_tutor(self, value):
        """Ensure tutor has the tutor role"""
        if value.role != "tutor":
            raise serializers.ValidationError(f"User must have tutor role, but has {value.role} role.")
        return value

    def get_course_name(self, obj):
        try:
            return obj.course.name if obj.course else None
        except Exception:
            return None

    def get_room_name(self, obj):
        try:
            return obj.room.name if obj.room else None
        except Exception:
            return None

    def get_tutor_name(self, obj):
        try:
            u = obj.tutor
            if not u:
                return None
            return getattr(u, 'name', None) or getattr(u, 'username', None) or getattr(u, 'email', None)
        except Exception:
            return None


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()
    event_details = serializers.SerializerMethodField()
    student_details = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ['id', 'user_email', 'action', 'event_details', 'student_details', 'notes', 'timestamp']

    def get_user_email(self, obj):
        return obj.user.email or obj.user.username

    def get_event_details(self, obj):
        try:
            if obj.event:
                return f"Course: {obj.event.course.name}, Time: {obj.event.date} {obj.event.start_time}"
        except Exception:
            pass
        return None

    def get_student_details(self, obj):
        try:
            if obj.student:
                return {"id": obj.student.id, "student_id": obj.student.student_id, "name": obj.student.name}
        except Exception:
            pass
        return None

    def get_notes(self, obj):
        try:
            return obj.notes
        except Exception:
            return None
