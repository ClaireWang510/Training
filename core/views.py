import hashlib
import json
import re
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from uuid import UUID

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import Cohort, Enrollment, Entry, Event, LoginThrottle, MarkChange, Sheet, Student


class Problem(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status


def check(condition, message, status=400):
    if not condition:
        raise Problem(message, status)


def string(value, size):
    check(isinstance(value, str) and 0 < len(value.strip()) <= size, "请核对必填字段和文字长度")
    return value.strip()


def optional_text(value, size):
    """可为空的文本字段：统一去除首尾空白并限制长度。"""
    check(value is None or isinstance(value, str), "请核对文字字段格式")
    text = (value or "").strip()
    check(len(text) <= size, "请核对必填字段和文字长度")
    return text


STUDENT_DETAILS = {"phone": 40, "email": 160, "grade": 40, "gender": 10}


def apply_student_details(student, source, overwrite_empty=False):
    """把联系方式等扩展资料写入学员记录。

    批量导入时未填写或未映射的字段保留原值；管理员手工编辑时允许清空。
    """
    changed = False
    for key, size in STUDENT_DETAILS.items():
        if key in source:
            value = optional_text(source[key], size)
            if overwrite_empty or value:
                if getattr(student, key) != value:
                    setattr(student, key, value)
                    changed = True
    check(student.gender in ("", "男", "女", "其他"), "请核对性别")
    return changed


def number(value):
    n = Decimal(str(value))
    check(n.is_finite() and n == n.quantize(Decimal(".01")), "学分最多保留两位小数")
    return n


def local_time(value):
    return timezone.make_aware(datetime.strptime(value, "%Y-%m-%dT%H:%M"))


@ensure_csrf_cookie
@never_cache
def index(request):
    return render(request, "index.html")


# 允许提供的静态资源类型。前端为原生 ES 模块，无需打包步骤。
ASSET_TYPES = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}


@require_GET
def asset(request, path):
    """提供 static/ 下的前端资源。

    路径经规范化处理后必须仍位于 static/ 目录内，防止目录穿越。
    """
    target = (settings.BASE / "static" / path).resolve()
    static_root = (settings.BASE / "static").resolve()
    if not target.is_relative_to(static_root) or not target.is_file():
        raise Http404
    content_type = ASSET_TYPES.get(target.suffix.lower())
    if content_type is None:
        raise Http404
    return FileResponse(target.open("rb"), content_type=content_type)


def admin(request):
    return request.user.is_authenticated and request.user.is_active and request.user.is_staff


def accessible(request):
    if admin(request):
        return Cohort.objects.all() if request.user.is_superuser else Cohort.objects.filter(owner=request.user)
    sid = request.session.get("sid")
    check(sid, "请先登录", 401)
    return Cohort.objects.filter(enrollment__student_id=sid)


def cohort_json(c, sid):
    students = Enrollment.objects.filter(cohort=c).select_related("student").order_by("cls","student_id")
    entries = Entry.objects.filter(event__cohort=c)
    if sid:
        students = students.filter(student_id=sid)
        entries = entries.filter(student_id=sid)
    data = {"key":str(c.pk),"name":c.name,"version":c.version,"start":str(c.start),"end":str(c.end),
            "students":[{"id":s.student_id,"name":s.student.name,"cls":s.cls,"dept":s.dept,
                         "phone":s.student.phone,"email":s.student.email,"grade":s.student.grade,
                         "gender":s.student.gender} for s in students],"events":[]}
    events = {}
    for e in c.event_set.order_by("starts","pk"):
        start = timezone.localtime(e.starts)
        events[e.pk] = {"id":str(e.pk),"title":e.title,"date":start.date().isoformat(),"time":start.strftime("%H:%M"),
            "deadline":timezone.localtime(e.deadline).strftime("%Y-%m-%dT%H:%M"),"place":e.place,"points":float(e.points),
            "questions":e.questions,"type":e.type,"regs":{},"marks":{}}
    for entry in entries.filter(event_id__in=events):
        if entry.answers is not None:
            events[entry.event_id]["regs"][entry.student_id] = entry.answers
        if entry.mark is not None:
            events[entry.event_id]["marks"][entry.student_id] = entry.mark
    data["events"] = list(events.values())
    return data


@require_GET
@never_cache
def state(request):
    if not admin(request) and not request.session.get("sid"):
        return JsonResponse({"role":"guest"})
    sid = None if admin(request) else request.session["sid"]
    return JsonResponse({"role":"student" if sid else "admin","sid":sid,
                         "cohorts":[cohort_json(c,sid) for c in accessible(request).order_by("-start","pk")]})


@require_GET
def health(request):
    """健康检查：确认进程与数据库均可。供部署后自检使用。"""
    from django.db import connection
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return JsonResponse({"status":"error","database":"unavailable"},status=503)
    return JsonResponse({"status":"ok","database":"ok"})


def sign_in(request, data):
    now = timezone.now()
    key = hashlib.sha256(request.META.get("REMOTE_ADDR","").encode()).hexdigest()
    # Commit failures as well as successes so limits are shared across workers.
    with transaction.atomic():
        item,_ = LoginThrottle.objects.select_for_update().get_or_create(key=key,defaults={"since":now})
        if now-item.since > timedelta(minutes=5):
            item.count, item.since = 0, now
        check(item.count < 60, "尝试次数过多，请稍后再试",429)
        if data.get("mode") == "admin":
            user = authenticate(request,username=string(data["id"],150),password=string(data["password"],512))
            ok = user and user.is_staff
            sid = None
        else:
            sid = string(data["id"],40)
            ok = Student.objects.filter(pk=sid,name=string(data["name"],80),enrollment__isnull=False).exists()
            user = None
        item.count = 0 if ok else item.count+1
        item.save()
    check(ok,"登录信息未匹配",401)
    request.session.flush()
    if user:
        login(request,user)
    else:
        request.session["sid"] = sid
    return {}


def cohort_fields(data):
    a,b = date.fromisoformat(data["start"]),date.fromisoformat(data["end"])
    check(a<=b,"结束日期早于开始日期")
    return dict(name=string(data["name"],100),start=a,end=b)


def import_roster(c, rows):
    check(isinstance(rows,list) and 0<len(rows)<=10000,"请分批导入，每批最多一万行")
    for row in rows:
        sid,name = string(row["id"],40),string(row["name"],80)
        check(re.fullmatch(r"[A-Za-z0-9_-]+",sid) and sid not in {"constructor","prototype","__proto__"}, "学号格式有误")
        s,_ = Student.objects.get_or_create(pk=sid,defaults={"name":name})
        check(s.name==name,"学号 "+sid+" 对应的姓名与已有账号冲突，请核对")
        if apply_student_details(s,row):
            s.save()
        Enrollment.objects.update_or_create(student=s,cohort=c,defaults={"dept":string(row["dept"],160),"cls":string(row["cls"],80)})


def update_student(c,data):
    """管理员直接修改本期学员资料。学号是稳定标识，不允许在此改动。"""
    row = data["student"]
    check(isinstance(row,dict),"学员资料格式有误")
    enrollment = Enrollment.objects.select_related("student").filter(
        cohort=c,student_id=string(row["id"],40)).first()
    check(enrollment,"学员不属于本期")
    student = enrollment.student
    student.name = string(row["name"],80)
    apply_student_details(student,row,overwrite_empty=True)
    student.save()
    enrollment.dept = string(row["dept"],160)
    enrollment.cls = string(row["cls"],80)
    enrollment.save()


def new_event(c,d):
    points = number(d["points"])
    starts,deadline = local_time(d["date"]+"T"+d["time"]),local_time(d["deadline"])
    check(0<points<=100 and d["type"] in ("必修","选修"),"请核对课程类型和学分")
    check(timezone.now()<deadline<=starts,"请核对报名截止时间和开课时间")
    qs=d["questions"]
    check(isinstance(qs,list) and len(qs)<=50,"最多可设置 50 道题")
    cleaned=[]
    for q in qs:
        t=q["type"]
        check(t in ("单选","多选","简答") and isinstance(q["options"],list) and isinstance(q["required"],bool),"问卷格式有误")
        opts=[string(x,200) for x in q["options"]]
        check(t=="简答" or 2<=len(set(opts))==len(opts)<=60,"请核对选项")
        cleaned.append(dict(type=t,label=string(q["label"],150),options=opts,required=q["required"]))
    return Event.objects.create(cohort=c,title=string(d["title"],100),place=string(d["place"],160),type=d["type"],
                                starts=starts,deadline=deadline,points=points,questions=cleaned)


def register(e,sid,data):
    check(timezone.now()<e.deadline,"报名已截止",409)
    record,_=Entry.objects.get_or_create(event=e,student_id=sid)
    check(record.mark is None,"已经登记出勤",409)
    if data.get("cancel") is True:
        record.delete()
        return
    answers=data["answers"]
    check(isinstance(answers,list) and len(answers)==len(e.questions),"问卷答案数量有误")
    for a,q in zip(answers,e.questions):
        if q["type"]=="多选":
            check(isinstance(a,list) and all(isinstance(x,str) and x in q["options"] for x in a) and len(a)==len(set(a)),"请核对多选答案")
        else:
            check(isinstance(a,str) and len(a)<=4000 and (q["type"]=="简答" or not a or a in q["options"]),"请核对答案")
        check(not q["required"] or bool(a.strip() if isinstance(a,str) else a),"请完成必答题")
    record.answers=answers
    record.save()


def mark_rows(e,actor,rows):
    check(timezone.now()>=e.starts,"活动开始后可登记出勤或补修")
    check(isinstance(rows,list) and 0<len(rows)<=10000,"请选择学员")
    enrolled=set(Enrollment.objects.filter(cohort=e.cohort).values_list("student_id",flat=True))
    for row in rows:
        sid=row["id"]
        check(sid in enrolled,"学员不属于本期")
        status,points=row["status"],number(row["points"])
        check(status in ("已到课","缺席","已补修") and 0<=points<=e.points,"参与状态或学分越界")
        check(status!="已补修" or e.type=="必修","选修课不支持补修")
        check(status!="缺席" or points==0,"缺席学分应为零")
        rec,_=Entry.objects.get_or_create(student_id=sid,event=e)
        value={"status":status,"points":float(points),"reason":string(row["reason"],1000)}
        if rec.mark!=value:
            MarkChange.objects.create(entry=rec,actor=actor,before=rec.mark,after=value)
            rec.mark=value
            rec.save()


def snapshot(e):
    final=timezone.now()>=e.deadline
    if final:
        existing=Sheet.objects.filter(event=e,final=True).first()
        if existing:
            return existing
    ids=Entry.objects.filter(event=e,answers__isnull=False).values("student_id")
    rows=[{"id":s.student_id,"name":s.student.name,"cls":s.cls} for s in Enrollment.objects.filter(
        cohort=e.cohort,student_id__in=ids).select_related("student").order_by("cls","student_id")]
    digest=hashlib.sha256(json.dumps(rows,ensure_ascii=False).encode()).hexdigest()
    sheet,_ = Sheet.objects.get_or_create(event=e,rows=rows,fingerprint=digest,final=final)
    if not sheet.xlsx:
        from .sheetfile import workbook
        sheet.xlsx=workbook(sheet)
        sheet.save(update_fields=["xlsx"])
    return sheet


@require_POST
@never_cache
def command(request,action):
    try:
        data=json.loads(request.body)
        check(isinstance(data,dict),"请求格式有误")
        if action=="login":
            return JsonResponse(sign_in(request,data))
        if action=="logout":
            logout(request)
            return JsonResponse({})
        is_admin=admin(request)
        check(is_admin or action=="register","需要管理员权限",403)
        with transaction.atomic():
            if action=="create":
                c=Cohort.objects.create(owner=request.user,**cohort_fields(data))
                return JsonResponse({"key":str(c.pk)})
            c=accessible(request).select_for_update().filter(pk=UUID(data["cohort"])).first()
            check(c,"无权访问该期培训班",403)
            if action not in ("register","sheet"):
                check(data.get("version")==c.version,"资料已变动，请核对更新后的页面再提交",409)
            if action=="settings":
                for k,v in cohort_fields(data).items():
                    setattr(c,k,v)
            elif action=="roster":
                import_roster(c,data["rows"])
            elif action=="student":
                update_student(c,data)
            elif action=="event":
                e=new_event(c,data)
            else:
                e=c.event_set.filter(pk=UUID(data["event"])).first()
                check(e,"活动不存在",404)
                if action=="register":
                    check(not is_admin,"请以学员身份报名",403)
                    register(e,request.session["sid"],data)
                elif action=="marks":
                    mark_rows(e,request.user,data["rows"])
                elif action=="sheet":
                    sheet=snapshot(e)
                    return JsonResponse({"key":str(sheet.pk),"rows":sheet.rows,"final":sheet.final})
                else:
                    raise Problem("未知操作",404)
            c.version+=1
            c.save()
            return JsonResponse({"event":str(e.pk)} if action=="event" else {})
    except Problem as ex:
        return JsonResponse({"error":ex.message},status=ex.status)
    except (ValueError,KeyError,TypeError,AttributeError,InvalidOperation):
        return JsonResponse({"error":"字段格式有误，请检查输入"},status=400)

@require_GET
@never_cache
def download_sheet(request,key):
    if not admin(request):
        raise Http404
    sheet=Sheet.objects.filter(pk=key,event__cohort__in=accessible(request)).select_related("event").first()
    if not sheet:
        raise Http404
    from io import BytesIO
    return FileResponse(BytesIO(bytes(sheet.xlsx)),as_attachment=True,filename=sheet.event.title+"签到表.xlsx",
                        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
