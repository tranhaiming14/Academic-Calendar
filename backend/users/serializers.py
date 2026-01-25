from rest_framework import serializers

from .models import StudentProfile, User
from calendar_app.models import Major

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "role")


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


class StaffSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    staff_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "name", "email", "role", "staff_id")

    def get_name(self, obj):
        try:
            for rel in ("tutor_profile", "academic_assistant_profile", "department_academic_assistant_profile", "administrator_profile"):
                prof = getattr(obj, rel, None)
                if prof and getattr(prof, "name", None):
                    return prof.name
        except Exception:
            pass
        return obj.first_name or obj.username or obj.email

    def get_staff_id(self, obj):
        try:
            role = getattr(obj, "role", None)
            if role == "tutor":
                prof = getattr(obj, "tutor_profile", None)
                return getattr(prof, "tutor_id", None) if prof else None
            if role == "academic_assistant":
                prof = getattr(obj, "academic_assistant_profile", None)
                return getattr(prof, "assistant_id", None) if prof else None
            if role == "department_assistant":
                prof = getattr(obj, "department_academic_assistant_profile", None)
                return getattr(prof, "dassistant_id", None) if prof else None
        except Exception:
            pass
        return None


class StaffCreateSerializer(serializers.Serializer):
    name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=[("tutor", "tutor"), ("academic_assistant", "academic_assistant"), ("department_assistant", "department_assistant")])
    staff_id = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        from django.contrib.auth import get_user_model
        import uuid

        UserModel = get_user_model()
        name = validated_data.get("name")
        email = validated_data.get("email")
        role = validated_data.get("role")
        provided_id = validated_data.get("staff_id") or ""

        username = email
        pwd = uuid.uuid4().hex[:12]

        user = UserModel.objects.create_user(username=username, email=email, password=pwd)
        user.role = role
        user.first_name = name
        user.save()

        # create a simple profile depending on role, use provided id when present
        try:
            if role == "tutor":
                from .models import TutorProfile
                tid = provided_id or uuid.uuid4().hex[:8]
                TutorProfile.objects.create(user=user, email=email, name=name, dob="2000-01-01", tutor_id=tid)
            elif role == "academic_assistant":
                from .models import AcademicAssistantProfile
                aid = provided_id or uuid.uuid4().hex[:8]
                AcademicAssistantProfile.objects.create(user=user, email=email, name=name, assistant_id=aid)
            elif role == "department_assistant":
                from .models import DepartmentAcademicAssistantProfile
                daid = provided_id or uuid.uuid4().hex[:8]
                DepartmentAcademicAssistantProfile.objects.create(user=user, email=email, name=name, dassistant_id=daid)
        except Exception:
            pass

        return user
