import uuid
from django.contrib.auth.models import User
from django.db import models

class Cohort(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.PROTECT)
    name = models.CharField(max_length=100)
    start = models.DateField()
    end = models.DateField()
    version = models.PositiveBigIntegerField(default=1)

class Student(models.Model):
    id = models.CharField(primary_key=True, max_length=40)
    name = models.CharField(max_length=80)

class Enrollment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.PROTECT)
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE)
    dept = models.CharField(max_length=160)
    cls = models.CharField(max_length=80)
    class Meta:
        unique_together = ("student","cohort")

class Event(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    type = models.CharField(max_length=2)
    points = models.DecimalField(max_digits=6,decimal_places=2)
    starts = models.DateTimeField()
    deadline = models.DateTimeField()
    place = models.CharField(max_length=160)
    questions = models.JSONField(default=list)

class Entry(models.Model):
    event = models.ForeignKey(Event,on_delete=models.CASCADE)
    student = models.ForeignKey(Student,on_delete=models.PROTECT)
    answers = models.JSONField(null=True)
    mark = models.JSONField(null=True)
    class Meta:
        unique_together = ("event","student")

class MarkChange(models.Model):
    entry = models.ForeignKey(Entry,on_delete=models.PROTECT)
    actor = models.ForeignKey(User,on_delete=models.PROTECT)
    timestamp = models.DateTimeField(auto_now_add=True)
    before = models.JSONField(null=True)
    after = models.JSONField()

class Sheet(models.Model):
    id = models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    event = models.ForeignKey(Event,on_delete=models.CASCADE)
    rows = models.JSONField()
    xlsx = models.BinaryField(default=bytes)
    fingerprint = models.CharField(max_length=64)
    created = models.DateTimeField(auto_now_add=True)
    final = models.BooleanField(default=False)
    class Meta:
        unique_together = ("event","fingerprint","final")

class LoginThrottle(models.Model):
    key = models.CharField(max_length=64,primary_key=True)
    since = models.DateTimeField()
    count = models.PositiveIntegerField(default=0)
