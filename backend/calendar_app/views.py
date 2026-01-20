from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import ScheduledEvent, Course, Room, AuditLog, Notification
from .serializers import ScheduledEventSerializer, AuditLogSerializer
from users.models import StudentProfile
import datetime
import logging

User = get_user_model()

logger = logging.getLogger(__name__)


def _notify_related_users(event, action_description):
    """
    Creates notifications for users related to an event operation.
    Related users:
    - Students taking the course (match by major + year)
    - The tutor assigned to the event
    - Admin/DAA/AA staff
    """
    notifications = []
    
    # 1. Students
    if event.course and event.course.major:
        students = StudentProfile.objects.filter(major=event.course.major, year=event.course.year).select_related('user')
        for sp in students:
            if sp.user:
                notif = Notification(
                    user=sp.user,
                    message=f"Event '{event.title}' for course '{event.course.name}' was {action_description}.",
                    event=event
                )
                notifications.append(notif)
                
    # 2. Tutor
    if event.tutor:
        notif = Notification(
            user=event.tutor,
            message=f"Your event '{event.title}' for '{event.course.name}' was {action_description}.",
            event=event
        )
        notifications.append(notif)
        
    # 3. Staff (Admins, DAA, AA)
    staff_users = User.objects.filter(role__in=["administrator", "department_assistant", "academic_assistant"])
    
    # Store IDs to avoid duplicates if user falls into multiple categories (e.g. staff who is also a tutor)
    notified_ids = {n.user.id for n in notifications}

    for staff in staff_users:
        if staff.id in notified_ids:
            continue
            
        Actor = "System"
        if event.tutor:
             Actor = event.tutor.username
        
        notif = Notification(
            user=staff,
            message=f"Event '{event.title}' ({event.course.name}) was {action_description}.", 
            event=event
        )
        notifications.append(notif)
        notified_ids.add(staff.id)
        
    if notifications:
        Notification.objects.bulk_create(notifications)
        logger.info(f"Created {len(notifications)} notifications for action '{action_description}' on event {event.id}")


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
        # Create audit log for event creation
        try:
            AuditLog.objects.create(user=request.user, action='createEvent', event=serializer.instance)
            _notify_related_users(serializer.instance, "created")
            logger.info(f"Audit log created for event creation: event_id={serializer.instance.id}, user={request.user.id}")
        except Exception as e:
            logger.exception(f"Failed to create audit log/notification for event creation: {e}")
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

    
    # Check if this is a Change Request approval (indicated by status='request_change' and having a related_event)
    if event.status == "request_change" and event.related_event:
        # Merge changes to parent
        parent = event.related_event
        parent.title = event.title
        parent.date = event.date
        parent.start_time = event.start_time
        parent.end_time = event.end_time
        parent.room = event.room
        parent.tutor = event.tutor
        parent.course = event.course
        parent.event_type = event.event_type
        # parent.status remains 'approved' (or we explicitly set it)
        parent.status = "approved"
        parent.save()
        
        # Notify about the approval/merge
        try:
            AuditLog.objects.create(user=request.user, action='approveEvent', event=parent)
            _notify_related_users(parent, "updated (Change Request Approved)")
            logger.info(f"Change Request merged: child={event.id} -> parent={parent.id}")
        except Exception as e:
            logger.exception(f"Failed to log/notify change request approval: {e}")
            
        # Delete the temporary change request event
        event.delete()
        
        return Response({"message": "Change Request approved and merged."})

    # Normal approval for pending events
    event.status = "approved"
    event.save()

    # Create audit log for event approval
    try:
        AuditLog.objects.create(user=request.user, action='approveEvent', event=event)
        _notify_related_users(event, "approved")
        logger.info(f"Audit log created for event approval: event_id={event.id}, user={request.user.id}")
    except Exception as e:
        logger.exception(f"Failed to create audit log/notification for event approval: {e}")

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

    try:
        AuditLog.objects.create(user=request.user, action='rejectEvent', event=event)
        _notify_related_users(event, "rejected")
    except Exception as e:
        logger.exception(f"Failed to create audit log/notification for rejection: {e}")

    return Response({"message": "Event rejected"})


# 2. AA / Owner - Edit or cancel pending event
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def edit_event(request, event_id):
    try:
        event = ScheduledEvent.objects.get(id=event_id)
    except ScheduledEvent.DoesNotExist:
        return Response({"error": "Event not found"}, status=404)

    # Allow editing regardless of status for admin/DAA
    # if event.status != "pending":
    #    return Response({"error": "Only pending events can be edited or cancelled"}, status=400)

    # Authorization:
    # 1. Admin / AA / DAA can always edit
    # 2. Tutor can edit ONLY if they are the event owner
    
    user_role = getattr(request.user, "role", "")
    is_authority = user_role in ("academic_assistant", "department_assistant", "administrator")
    is_owner = (user_role == "tutor" and event.tutor == request.user)

    if not (is_authority or is_owner):
        return Response({"detail": "Permission denied."}, status=403)

    data = request.data.copy() if isinstance(request.data, dict) else dict(request.data)
    action = data.pop("action", None)
    if action == "cancel":
        # allow creator or AA/admin
        event.status = "cancelled"
        event.save()
        
        try:
            AuditLog.objects.create(user=request.user, action='cancelEvent', event=event)
            _notify_related_users(event, "cancelled")
        except Exception as e:
            logger.exception(f"Failed to create audit log/notification for cancel: {e}")
            
        return Response({"message": "Event cancelled"})

    # If tutor or AA edits, force status back to pending
    # AA can edit ANY event (is_authority=True), but needs status reset.
    # DAA/Admin can edit ANY event and KEEP status.
    
    original_status = event.status
    should_reset_status = (is_owner and user_role == "tutor") or (user_role == "academic_assistant")
    
    if should_reset_status:
        event.status = "pending"
    
    # helper for partial update
    serializer = ScheduledEventSerializer(event, data=data, partial=True)
    if serializer.is_valid():
        # Check if we should create a Change Request instead of direct edit
        # If event is ALREADY approved, and user is NOT Admin/DAA (i.e. is Tutor or AA), or even if Admin wants to follow protocol?
        # User request: "For AA and tutor, upon editing approved events... make this a change request."
        # "DAA and Admin... can now approve the request_change events as if they are pending events."
        # This implies DAA/Admin MIGHT want to just direct edit, OR approve requests.
        # Let's assume strict workflow: modifying an APPROVED event -> Change Request (unless maybe Admin forces it, but let's stick to the request).
        # "The first one is to create another identical event..."
        
        # Check if we should create a Change Request instead of direct edit
        # Only require Change Request for Tutor and AA
        
        should_create_change_request = (
            original_status == "approved" 
            and user_role not in ("administrator", "department_assistant")
        )

        if should_create_change_request:
            # Clone Approach: Create NEW event with status='request_change' linked to this one
            # copying fields from the serializer validated data + existing event data
            new_data = serializer.validated_data
            
            # Create new instance
            # We need to manually construct the payload for the new event based on merged data
            # Use the 'event' object as base, and update with 'new_data'
            
            # We can use the serializer to save a NEW instance if we pass instance=None?
            # No, 'serializer' is bound to 'event'.
            
            # Let's create a new serializer for the new event
            # Merge current event data with new data
            # But 'data' might be partial.
            
            # Simple way:
            # 1. iterate fields in new_data, update a temporary copy or dictionary
            
            new_event_payload = {
                "title": new_data.get("title", event.title),
                "date": new_data.get("date", event.date),
                "start_time": new_data.get("start_time", event.start_time),
                "end_time": new_data.get("end_time", event.end_time),
                "event_type": new_data.get("event_type", event.event_type),
                "status": "request_change",
                # Foreign keys are tricky in validated_data (they are model instances)
                "course": new_data.get("course", event.course).id,
                "tutor": new_data.get("tutor", event.tutor).id if new_data.get("tutor", event.tutor) else None,
                "room": new_data.get("room", event.room).id,
                "related_event": event.id 
            }
            
            # Use serializer to creating new
            new_serializer = ScheduledEventSerializer(data=new_event_payload)
            if new_serializer.is_valid():
                instance = new_serializer.save()
                instance.status = "request_change"
                instance.save()
                
                # Notify/Log (Change Request Created)
                try:
                    AuditLog.objects.create(user=request.user, action='createEvent', event=new_serializer.instance) # Action could be 'createChangeRequest' but 'createEvent' works
                    _notify_related_users(event, f"Change Request Created (ID: {new_serializer.instance.id})") # Notify on PARENT event context?
                except Exception:
                    pass
                    
                return Response(new_serializer.data, status=201)
            else:
                return Response(new_serializer.errors, status=400)

        # Standard edit path (for pending events)
        serializer.save()
        # if we forcibly changed status, save it (serializer might not if it's read-only)
        if event.status == "pending":
            event.save()
        
        try:
            AuditLog.objects.create(user=request.user, action='editEvent', event=event)
            _notify_related_users(event, "updated")
        except Exception as e:
            logger.exception(f"Failed to create audit log/notification for edit: {e}")

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
def all_tutors(request):
    # Return ALL tutors
    tutors = User.objects.filter(role="tutor")
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
    
    # Exclude logic for editing
    exclude_id = request.query_params.get("exclude")
    if exclude_id:
        events = events.exclude(id=exclude_id)

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
    busy_qs = ScheduledEvent.objects.filter(date=d).filter(~Q(end_time__lte=s) & ~Q(start_time__gte=e))
    
    # Exclude logic for editing
    exclude_id = request.query_params.get("exclude")
    if exclude_id:
        busy_qs = busy_qs.exclude(id=exclude_id)
        
    busy_rooms = busy_qs.values_list('room', flat=True)
    qs = Room.objects.exclude(id__in=list(busy_rooms))
    data = [{"id": r.id, "name": r.name} for r in qs]
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def scheduledevents_list(request):
    """Return scheduled events filtered by user's role, profile, and date range.
    
    Query Parameters:
    - start: Start date (YYYY-MM-DD format)
    - end: End date (YYYY-MM-DD format)
    """
    user = request.user
    
    # Parse start and end dates from query parameters
    start_date_str = request.query_params.get('start')
    end_date_str = request.query_params.get('end')
    
    logger.info(f"scheduledevents_list called by user: {user}, authenticated: {user.is_authenticated}, role: {getattr(user, 'role', None)}")
    logger.info(f"Query params - start: {start_date_str}, end: {end_date_str}")
    
    # Base queryset
    qs = ScheduledEvent.objects.all().order_by('date', 'start_time')
    
    if start_date_str and end_date_str:
        try:
            import datetime
            start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
            qs = qs.filter(date__gte=start_date, date__lte=end_date)
            logger.info(f"Filtering events from {start_date} to {end_date}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid date format: start={start_date_str}, end={end_date_str}, error={e}")
    else:
        logger.warning(f"Missing date parameters: start={start_date_str}, end={end_date_str}")
    
    # If user is a student, filter by their major and year
    if user.role == "student":
        try:
            student_profile = StudentProfile.objects.get(user=user)
            logger.info(f"Student profile found: major={student_profile.major}, year={student_profile.year}")
            if student_profile.major and student_profile.year:
                qs = qs.filter(
                    course__major=student_profile.major,
                    course__year=student_profile.year
                )
                logger.info(f"Filtered events for student: {qs.count()} events")
        except StudentProfile.DoesNotExist:
            logger.warning(f"No student profile found for user {user}")
            # If no profile, return no events for safety
            qs = qs.none()
    
    # For all other roles (tutor, academic_assistant, department_assistant, administrator), return all events
    logger.info(f"Returning {qs.count()} events for user {user}")
    
    serializer = ScheduledEventSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def events_fallback(request):
    """Backward-compatible endpoint: /calendar/events/"""
    # `request` here is a DRF `Request` (because this view is an API view).
    # Calling another `@api_view`-decorated view with a DRF `Request` causes
    # DRF to try to wrap it again and raises an assertion. Pass the
    # underlying Django `HttpRequest` object instead so the decorated
    # `scheduledevents_list` can re-wrap it properly.
    underlying = getattr(request, '_request', request)
    return scheduledevents_list(underlying)


import csv
from django.http import HttpResponse

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_calendar(request):
    """
    Export events to CSV for Google Calendar import.
    Query params: start (YYYY-MM-DD), end (YYYY-MM-DD)
    """
    start_q = request.query_params.get("start")
    end_q = request.query_params.get("end")

    if not start_q or not end_q:
        return Response({"detail": "start and end query params are required (YYYY-MM-DD)"}, status=400)

    try:
        start_date = datetime.date.fromisoformat(start_q)
        end_date = datetime.date.fromisoformat(end_q)
    except ValueError:
        return Response({"detail": "Invalid date format"}, status=400)

    # Filter events
    events = ScheduledEvent.objects.filter(
        date__range=[start_date, end_date],
        status="approved" # Only approved events? Or pending too? User said "export calendar", implying the official one. Let's do approved + pending if user is owner?
        # For simplicity and "Google Calendar" usage, usually means what I see on the calendar.
        # Let's export ALL events for now, or maybe just approved.
        # User didn't specify status. "Export calendar" usually implies the public/visible one.
        # Re-reading: "Output should be a csv file to import to a google calendar"
        # Let's export all non-rejected/cancelled logic effectively?
        # The public list returns ALL events. Let's stick to that matching 'scheduledevents_list' which returns all.
        # Wait, 'scheduledevents_list' returns all.
        # But 'export' usually implies personal agenda?
        # The prompt says "user be able to export calendar".
        # Let's filter by status='approved' to be safe, creating a clean calendar.
    ).filter(status='approved').order_by('date', 'start_time')

    # Create response
    response = HttpResponse(
        content_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="calendar_export.csv"'},
    )

    writer = csv.writer(response)
    # Google Calendar CSV headers: Subject, Start Date, Start Time, End Date, End Time, All Day Event, Description, Location, Private
    writer.writerow(["Subject", "Start Date", "Start Time", "End Date", "End Time", "All Day Event", "Description", "Location"])

    for event in events:
        # Subject: Course name - Title (Type)
        subject = f"{event.course.name} - {event.title} ({event.event_type})"
        
        # Date: DD/MM/YYYY
        s_date = event.date.strftime("%d/%m/%Y")
        
        # Time: HH:MM
        s_time = event.start_time.strftime("%H:%M")
        e_time = event.end_time.strftime("%H:%M")
        
        tutor_name = event.tutor.username if event.tutor else "TBD"
        description = f"Tutor: {tutor_name}"
        # Removed event.notes as it is not in the model
        
        location = event.room.name if event.room else "TBD"

        writer.writerow([
            subject,
            s_date,
            s_time,
            s_date, 
            e_time,
            "False",
            description,
            location
        ])

    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_audit_logs(request):
    # Only administrators can view audit logs
    if request.user.role != "administrator":
        return Response({"detail": "Not found."}, status=404)
    logs = AuditLog.objects.all().order_by("-timestamp")
    serializer = AuditLogSerializer(logs, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_notifications(request):
    """
    Returns readonly list of notifications for the current user.
    Ordered by most recent first.
    """
    try:
        # Fetch notifications
        notifs = Notification.objects.filter(user=request.user).order_by('-created_at')[:50] # Limit to 50 for now
        
        data = []
        for n in notifs:
            data.append({
                "id": n.id,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            })
            
        return Response(data, status=200)
    except Exception as e:
        logger.error(f"Error fetching notifications for user {request.user.id}: {e}")
        return Response({"detail": "Error fetching notifications"}, status=500)
