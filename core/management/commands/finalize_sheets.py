from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from core.models import Cohort, Event
from core.views import snapshot

class Command(BaseCommand):
    help="冻结已截止活动的正式签到名单；可定时重复执行"
    def handle(self, **options):
        from core.models import Sheet
        frozen=Sheet.objects.filter(final=True).values("event_id")
        for event in Event.objects.filter(deadline__lte=timezone.now()).exclude(pk__in=frozen).iterator():
            with transaction.atomic():
                Cohort.objects.select_for_update().get(pk=event.cohort_id)
                snapshot(event)
