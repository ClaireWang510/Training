import json
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch
from zipfile import ZipFile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, TestCase
from django.utils import timezone

from .models import Cohort, Entry, Event, MarkChange, Sheet

class WorkflowTest(TestCase):
    def setUp(self):
        self.admin=Client()
        self.owner=User.objects.create_user("manager",password="testing-pass",is_staff=True)
        self.admin.force_login(self.owner)
        def post(actor, action, **data):
            return actor.post("/api/"+action,data=data,content_type="application/json")
        self.post=post
        self.key=self.post(self.admin,"create",name="培训班",start="2026-01-01",end="2027-12-31").json()["key"]
        self.cmd=lambda action,**kw: post(self.admin,action,**{"cohort":self.key,"version":Cohort.objects.get(pk=self.key).version,**kw})
        self.rows=[dict(id=i,name=n,dept="院系",cls="一班") for i,n in [("0001","甲"),("0002","乙")]]
        self.assertEqual(self.cmd("roster",rows=self.rows).status_code,200)
        tomorrow=timezone.localtime()+timedelta(days=1)
        self.e=self.cmd("event",title="必修课",type="必修",points=2,date=tomorrow.date().isoformat(),time="18:00",
                        deadline=tomorrow.strftime("%Y-%m-%dT12:00"),place="教室",questions=[dict(type="单选",label="时段",options=["早","晚"],required=True)]).json()["event"]
        self.s=Client()
        self.assertEqual(post(self.s,"login",mode="student",id="0001",name="甲").status_code,200)
        self.join=lambda **data: post(self.s,"register",cohort=self.key,event=self.e,**data)

    def ended(self):
        Event.objects.filter(pk=self.e).update(starts=timezone.now()-timedelta(minutes=10),deadline=timezone.now()-timedelta(hours=1))

    def test_registration_and_fixed_export(self):
        self.assertEqual(self.join(answers=[""]).status_code,400)
        self.assertEqual(self.join(answers=["早"]).status_code,200)
        self.assertEqual(self.join(answers=["晚"]).status_code,200)
        self.assertEqual(Entry.objects.count(),1)
        self.assertEqual(self.join(cancel=True).status_code,200)
        self.assertEqual(Entry.objects.count(),0)
        self.join(answers=["早"])
        self.ended()
        self.assertEqual(self.join(cancel=True).status_code,409)
        call_command("finalize_sheets");call_command("finalize_sheets")
        sheet=Sheet.objects.get()
        self.assertEqual(sheet.rows[0]["id"],"0001")
        self.assertTrue(sheet.final)
        data=b"".join(self.admin.get("/sheets/"+str(sheet.pk)).streaming_content)
        self.assertIn("0001",ZipFile(BytesIO(data)).read("xl/worksheets/sheet1.xml").decode())
        self.assertEqual(self.s.get("/sheets/"+str(sheet.pk)).status_code,404)

    def test_marks_makeup_and_isolation(self):
        self.ended()
        row=dict(id="0001",status="缺席",points=0,reason="现场核对")
        self.assertEqual(self.cmd("marks",event=self.e,rows=[row]).status_code,200)
        row.update(status="已补修",points=2,reason="已补交作业")
        for _ in range(2):
            self.assertEqual(self.cmd("marks",event=self.e,rows=[row]).status_code,200)
        self.assertEqual(MarkChange.objects.count(),2)
        self.assertEqual(Entry.objects.count(),1)
        state=self.s.get("/api/state").json()["cohorts"][0]
        self.assertEqual([x["id"] for x in state["students"]],["0001"])
        self.assertEqual(state["events"][0]["marks"]["0001"],dict(status="已补修",points=2,reason="已补交作业"))
        self.assertEqual(self.post(self.s,"marks").status_code,403)
        self.assertEqual(self.cmd("marks",event=self.e,rows=[{**row,"points":3}]).status_code,400)

    def test_scope_stale_updates_and_rollback(self):
        other=Client()
        other.force_login(User.objects.create_user("other",is_staff=True))
        self.assertFalse(other.get("/api/state").json()["cohorts"])
        self.assertEqual(self.post(other,"roster",cohort=self.key,rows=self.rows).status_code,403)
        self.assertEqual(self.cmd("roster",version=0,rows=self.rows).status_code,409)
        self.assertEqual(self.cmd("roster",rows=[{**self.rows[0],"cls":"二班"},{**self.rows[1],"name":"丙"}]).status_code,400)
        self.assertEqual(Cohort.objects.get().enrollment_set.get(student_id="0001").cls,"一班")
        self.s.post("/api/logout",{},content_type="application/json")
        self.assertEqual(self.s.get("/api/state").json(),{"role":"guest"})
        self.assertEqual(Client(enforce_csrf_checks=True).post("/api/login",{},content_type="application/json").status_code,403)

    def test_model_suggestions_do_not_award_credit(self):
        self.join(answers=["早"])
        sheet=self.cmd("sheet",event=self.e).json()["key"]
        result={"sheet":sheet,"rows":[{"row":1,"tail":"0001","state":"signed"}]}
        response=BytesIO(json.dumps({"choices":[{"message":{"content":json.dumps(result)}}]}).encode())
        with patch.dict("os.environ",{"VISION_CHAT_URL":"http://localhost/model","VISION_MODEL":"test"}),patch("core.vision.urlopen",return_value=response):
            res=self.admin.post("/api/recognize",dict(sheet=sheet,event=self.e,photo=SimpleUploadedFile("page.jpg",b"\xff\xd8\xffdata")))
        self.assertEqual(res.json(),{"signed":["0001"]})
        self.assertIsNone(Entry.objects.get().mark)
