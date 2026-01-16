from django.urls import path
from . import views

urlpatterns = [
    path("approve/<int:event_id>/", views.approve_event),
    path("reject/<int:event_id>/", views.reject_event),
    # Public API endpoints used by frontend
    path("courses/", views.courses_list),
    path("courses/<int:course_id>/tutors/", views.course_tutors),
    path("tutors/", views.all_tutors),
    path("tutors/<int:tutor_id>/schedules/", views.tutor_schedules),
    path("rooms/available/", views.rooms_available),
    path("scheduledevents/", views.scheduledevents_list),
    path("events/", views.events_fallback),
    path("create_event/", views.create_event),
    path("edit_event/<int:event_id>/", views.edit_event),
    path("export/", views.export_calendar),
    # Audit logs
    path("audit/logs/", views.get_audit_logs),
]
