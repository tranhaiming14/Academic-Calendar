from django.urls import path
from . import views

urlpatterns = [
    path("create/", views.create_event),
    path("edit/<int:event_id>/", views.edit_event),
    path("approve/<int:event_id>/", views.approve_event),
    path("reject/<int:event_id>/", views.reject_event),
    path("tutor-events/", views.tutor_events),
    path("approved/", views.approved_events),
    # Public API endpoints used by frontend
    path("courses/", views.courses_list),
    path("courses/<int:course_id>/tutors/", views.course_tutors),
    path("tutors/<int:tutor_id>/schedules/", views.tutor_schedules),
    path("rooms/available/", views.rooms_available),
    path("scheduledevents/", views.scheduledevents_list),
    path("events/", views.events_fallback),
    path("create_event/", views.create_event),
]
