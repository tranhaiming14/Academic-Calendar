from rest_framework import serializers

from .models import StudentProfile, User
from calendar_app.models import Major

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("username", "email", "role")


class StudentProfileSerializer(serializers.ModelSerializer):
    # Return major as an object with id and name for easier frontend display
    major = serializers.SerializerMethodField()
    # allow writing major by id when creating/updating
    major_id = serializers.PrimaryKeyRelatedField(queryset=Major.objects.all(), source='major', write_only=True, required=False, allow_null=True)
    # indicate whether this student is eligible to advance
    can_advance = serializers.BooleanField(required=False)
    class Meta:
        model = StudentProfile
        # accept user as optional; save() will create the user if missing
        fields = ("id", "user", "name", "email", "dob", "student_id", "major", "major_id", "year", "can_advance")
        read_only_fields = ("id",)

    def create(self, validated_data):
        # Leave creation logic to model.save() which creates a User when user is None
        profile = StudentProfile(**validated_data)
        profile.save()
        return profile

    def get_major(self, obj):
        if obj.major:
            return {"id": obj.major.id, "name": obj.major.name}
        return None
