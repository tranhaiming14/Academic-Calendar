from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import ScheduledEvent, Course, Room
from .serializers import ScheduledEventSerializer
import datetime
import logging

User = get_user_model()

logger = logging.getLogger(__name__)

def _parse_time(t: str):
    try:
        return datetime.datetime.strptime(t, "%H:%M").time()
    except Exception:
        return None


def _require_role_or_404(request, allowed_roles):
    try:
        role = getattr(request.user, "role", None)
    except Exception:
        role = None
    if role not in allowed_roles:
        logger.warning(f"Unauthorized role access attempt by user={getattr(request.user, 'id', None)} role={role} allowed={allowed_roles}")
        return Response({"detail": "Not found."}, status=404)
    return None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_event(request):
    data = request.data.copy()
    user_info = request.user if hasattr(request, 'user') and request.user and getattr(request.user, 'is_authenticated', False) else 'anonymous'
    logger.info(f"create_event called by {user_info}; payload={data}")
    # Permission: only academic assistants and administrators may create events
    res = _require_role_or_404(request, ("academic_assistant", "administrator"))
    if res:
        return res

    # resolve course
    course_val = data.get("course")
    if course_val is None:
        logger.warning("create_event missing 'course' in payload")
        return Response({"course": "This field is required."}, status=400)
    try:
        course = Course.objects.get(pk=course_val)
    except Exception:
        # try lookup by name (or create)
        try:
            course, created = Course.objects.get_or_create(name=course_val)
            if created:
                logger.info(f"Created Course entry for provided value: {course_val} (id={course.id})")
        except Exception as e:
            logger.exception(f"Failed to resolve or create Course from value={course_val}: {e}")
            return Response({"course": "Invalid course value."}, status=400)

    tutor_val = data.get("tutor")
    if not tutor_val:
        logger.warning("create_event missing 'tutor' in payload")
        return Response({"tutor": "This field is required."}, status=400)
    try:
        tutor = User.objects.get(pk=tutor_val)
    except Exception:
        logger.warning(f"Tutor not found for id/value: {tutor_val}")
        return Response({"tutor": "Tutor not found."}, status=400)

    date_val = data.get("date")
    if not date_val:
        logger.warning("create_event missing 'date' in payload")
        return Response({"date": "This field is required."}, status=400)
    try:
        date_obj = datetime.date.fromisoformat(date_val)
    except Exception:
        logger.warning(f"Invalid date format received: {date_val}")
        return Response({"date": "Invalid date format, expected YYYY-MM-DD."}, status=400)

    start_s = data.get("start_time")
    end_s = data.get("end_time")
    start_time = _parse_time(start_s) if start_s else None
    end_time = _parse_time(end_s) if end_s else None
    if not start_time or not end_time:
        logger.warning(f"Invalid or missing start/end times: start={start_s}, end={end_s}")
        return Response({"detail": "start_time and end_time are required in HH:MM format."}, status=400)
    if start_time >= end_time:
        logger.warning(f"start_time >= end_time: start={start_time}, end={end_time}")
        return Response({"detail": "start_time must be before end_time."}, status=400)

    # event_type required
    event_type = data.get("event_type")
    if not event_type:
        logger.warning("create_event missing 'event_type' in payload")
        return Response({"event_type": "This field is required."}, status=400)
    # validate against model choices if possible
    try:
        valid_choices = [c[0] for c in ScheduledEvent.EVENT_TYPES]
        if event_type not in valid_choices:
            logger.warning(f"Invalid event_type received: {event_type}")
            return Response({"event_type": "Invalid event_type."}, status=400)
    except Exception:
        # if ScheduledEvent not accessible for some reason, skip validation
        pass

    # resolve/create room
    room_val = data.get("room")
    room = None
    if room_val:
        try:
            room = Room.objects.get(pk=room_val)
        except Exception:
            try:
                room, created = Room.objects.get_or_create(name=room_val)
                if created:
                    logger.info(f"Created Room entry for provided value: {room_val} (id={room.id})")
            except Exception as e:
                logger.exception(f"Failed to resolve or create Room from value={room_val}: {e}")
                return Response({"room": "Invalid room value."}, status=400)

    # Check tutor overlap
    tutor_conflicts = ScheduledEvent.objects.filter(
        tutor=tutor,
        date=date_obj,
    ).filter(~Q(end_time__lte=start_time) & ~Q(start_time__gte=end_time))
    if tutor_conflicts.exists():
        logger.info(f"Tutor conflict detected for tutor={tutor.id} date={date_obj}: {tutor_conflicts.count()} conflicting events")
        return Response({"detail": "Tutor has a conflicting schedule."}, status=400)

    # Check room overlap
    if room:
        room_conflicts = ScheduledEvent.objects.filter(
            room=room,
            date=date_obj,
        ).filter(~Q(end_time__lte=start_time) & ~Q(start_time__gte=end_time))
        if room_conflicts.exists():
            logger.info(f"Room conflict detected for room={room.id} date={date_obj}: {room_conflicts.count()} conflicting events")
            return Response({"detail": "Room is already booked for that timeframe."}, status=400)

    # All good: prepare serializer payload
    payload = data
    payload["course"] = course.id
    payload["tutor"] = tutor.id
    payload["room"] = room.id if room else None
    payload["event_type"] = event_type

    serializer = ScheduledEventSerializer(data=payload)
    if serializer.is_valid():
        serializer.save()
        logger.info(f"ScheduledEvent created: id={serializer.instance.id}, title={serializer.instance.title}, course={course.id}, tutor={tutor.id}, date={date_obj}, start={start_time}, end={end_time}, room={room.id if room else None}")
        return Response(serializer.data, status=201)
    else:
        logger.warning(f"ScheduledEvent serializer errors: {serializer.errors}")
        return Response(serializer.errors, status=400)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_event(request, event_id):
    try:
        event = ScheduledEvent.objects.get(id=event_id)
    except ScheduledEvent.DoesNotExist:
        return Response({"error": "Event not found"}, status=404)

    # Only department academic assistants and administrators can approve
    res = _require_role_or_404(request, ("department_assistant", "administrator"))
    if res:
        return res

    event.status = "approved"
    event.save()

    return Response({"message": "Event approved"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_event(request, event_id):
    try:
        event = ScheduledEvent.objects.get(id=event_id)
    except ScheduledEvent.DoesNotExist:
        return Response({"error": "Event not found"}, status=404)

    # Only department academic assistants and administrators can reject
    res = _require_role_or_404(request, ("department_assistant", "administrator"))
    if res:
        return res

    event.status = "rejected"
    event.save()

    return Response({"message": "Event rejected"})


# 2. AA / Owner - Edit or cancel pending event
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def edit_event(request, event_id):
    try:
        event = ScheduledEvent.objects.get(id=event_id)
    except ScheduledEvent.DoesNotExist:
        return Response({"error": "Event not found"}, status=404)

    if event.status != "pending":
        return Response({"error": "Only pending events can be edited or cancelled"}, status=400)

    # Only academic assistants and administrators can edit pending events
    res = _require_role_or_404(request, ("academic_assistant", "administrator"))
    if res:
        return res

    data = request.data.copy() if isinstance(request.data, dict) else dict(request.data)
    action = data.pop("action", None)
    if action == "cancel":
        # allow creator or AA/admin (checked above)
        event.status = "cancelled"
        event.save()
        return Response({"message": "Event cancelled"})

    # perform partial update; serializer protects read-only fields (status)
    serializer = ScheduledEventSerializer(event, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


# Public endpoints used by frontend
@api_view(["GET"])
@permission_classes([AllowAny])
def courses_list(request):
    qs = Course.objects.all().order_by("name")
    data = [{"id": c.id, "name": c.name} for c in qs]
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def course_tutors(request, course_id):
    # Return tutors who teach the course (based on TutorProfile.courses)
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return Response([], status=200)

    # Users with a tutor_profile that references this course
    tutors = User.objects.filter(role="tutor", tutor_profile__courses=course).distinct()
    data = [{"id": t.id, "name": getattr(t, "name", None) or getattr(t, "username", t.email)} for t in tutors]
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def tutor_schedules(request, tutor_id):
    date_q = request.query_params.get("date")
    if not date_q:
        return Response({"detail": "date query param is required (YYYY-MM-DD)"}, status=400)
    try:
        d = datetime.date.fromisoformat(date_q)
    except Exception:
        return Response({"detail": "invalid date format"}, status=400)
    events = ScheduledEvent.objects.filter(tutor_id=tutor_id, date=d)
    data = [{"start_time": e.start_time.strftime("%H:%M"), "end_time": e.end_time.strftime("%H:%M")} for e in events]
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def rooms_available(request):
    date_q = request.query_params.get("date")
    start_q = request.query_params.get("start")
    end_q = request.query_params.get("end")
    if not date_q or not start_q or not end_q:
        return Response({"detail": "date, start and end query params are required"}, status=400)
    try:
        d = datetime.date.fromisoformat(date_q)
        s = _parse_time(start_q)
        e = _parse_time(end_q)
    except Exception:
        return Response({"detail": "invalid date/time format"}, status=400)
    if not s or not e:
        return Response({"detail": "invalid time format, expected HH:MM"}, status=400)
    # rooms that do NOT have any events overlapping
    busy_rooms = ScheduledEvent.objects.filter(date=d).filter(~Q(end_time__lte=s) & ~Q(start_time__gte=e)).values_list('room', flat=True)
    qs = Room.objects.exclude(id__in=list(busy_rooms))
    data = [{"id": r.id, "name": r.name} for r in qs]
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def scheduledevents_list(request):
    """Public: return all scheduled events (no auth)."""
    qs = ScheduledEvent.objects.all().order_by('date', 'start_time')
    serializer = ScheduledEventSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([AllowAny])
def events_fallback(request):
    """Backward-compatible endpoint: /calendar/events/"""
    return scheduledevents_list(request)
