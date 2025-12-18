from rest_framework import serializers
from .models import ScheduledEvent, Course, Room
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
