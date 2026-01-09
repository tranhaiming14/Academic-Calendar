"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView, RedirectView
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path("api/calendar/", include("calendar_app.urls")),
    # Frontend routes
    path("auth/login", TemplateView.as_view(template_name="index.html")),
    path("profile", TemplateView.as_view(template_name="index.html")),
    path("profile/student", TemplateView.as_view(template_name="index.html")),
    path("calendar", TemplateView.as_view(template_name="index.html")),
    path("create", TemplateView.as_view(template_name="index.html")),
    path("approve", TemplateView.as_view(template_name="index.html")),
    # Check if we need to catch sub-paths or just strict paths.
    # React Router handles sub-paths usually, but Django needs to hand off.
    
    # Redirect root to the frontend profile route so users see the profile
    # page immediately when visiting the site (frontend-only view).
    path("", RedirectView.as_view(url="/profile")),
]
if settings.DEBUG:
    try:
        import debug_toolbar  # type: ignore
        urlpatterns = [path("__debug__/", include(debug_toolbar.urls))] + urlpatterns
    except Exception:
        # debug_toolbar not installed; ignore in non-dev environments
        pass