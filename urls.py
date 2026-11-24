from django.urls import path
from core import views, vision

urlpatterns = [
    path("", views.index),
    path("static/<path:path>", views.asset),
    path("sheets/<uuid:key>", views.download_sheet),
    path("api/state", views.state),
    path("api/health", views.health),
    path("api/recognize", vision.recognize),
    path("api/<str:action>", views.command),
]
