from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from django.db import models

from .models import StudentProfile
from calendar_app.models import Major, AuditLog
from .serializers import StudentProfileSerializer, UserSerializer
from .permissions import IsDAAOrAdminOrHasModelPerm
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.db.models import F
from .serializers import StaffSerializer, StaffCreateSerializer
from rest_framework import generics
from django.db import models


class UserProfileView(generics.RetrieveUpdateAPIView):
	"""Retrieve or update the current user's profile.
	Allows the authenticated user to view and edit their own `username`/`email`.
	"""
	serializer_class = UserSerializer
	permission_classes = [IsAuthenticated]

	def get_object(self):
		return self.request.user


class StudentProfileCreateView(generics.CreateAPIView):
	"""Create a StudentProfile. Only DAA, Admin or users with the
	`users.can_create_student` permission may create student profiles.
	"""
	queryset = StudentProfile.objects.all()
	serializer_class = StudentProfileSerializer
	permission_classes = (IsDAAOrAdminOrHasModelPerm,)

	def create(self, request, *args, **kwargs):
			resp = super().create(request, *args, **kwargs)
			# create audit log for created student
			try:
				# serializer saved instance is available on response data id; fetch profile
				created_id = resp.data.get('id') if isinstance(resp.data, dict) else None
				if created_id:
					sp = StudentProfile.objects.filter(id=created_id).first()
					if sp:
						try:
							AuditLog.objects.create(user=request.user, action='createStudent', student=sp)
						except Exception:
							pass
			except Exception:
				pass
			return resp


class StudentImportView(APIView):
	"""Import students from an uploaded Excel file.

	Expected Excel columns (in order or by header name):
	  - name
	  - dob (date or string parseable to date)
	  - email
	  - student_id

	The created user will have:
	  - username: the student's `name` (string)
	  - email: the student's `email`
	  - password: `student_id` + `dob` formatted as ddmmyy

	The view requires `IsDAAOrAdminOrHasModelPerm` permission.
	"""
	parser_classes = (MultiPartParser, FormParser)
	permission_classes = (IsDAAOrAdminOrHasModelPerm,)

	def post(self, request, format=None):
		upload = request.FILES.get("file")
		if not upload:
			return Response({"detail": "No file uploaded (use 'file' form field)."}, status=status.HTTP_400_BAD_REQUEST)

		# lazy import so project doesn't hard-require openpyxl until used
		try:
			import openpyxl
		except Exception:
			return Response({"detail": "openpyxl is required to import Excel files. Install it in your environment."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

		try:
			wb = openpyxl.load_workbook(upload, data_only=True)
		except Exception as exc:
			return Response({"detail": f"Failed to read Excel file: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

		sheet = wb.active
		rows = list(sheet.iter_rows(values_only=True))
		if not rows:
			return Response({"detail": "Excel file is empty."}, status=status.HTTP_400_BAD_REQUEST)

		# Normalize headers (lowercase, collapse spaces, remove punctuation)
		import re

		def normalize(s):
			if s is None:
				return ""
			s = str(s)
			s = s.strip().lower()
			# replace non-alphanumeric with space, collapse spaces
			s = re.sub(r"[^0-9a-z]+", " ", s)
			s = re.sub(r"\s+", " ", s).strip()
			return s

		raw_headers = rows[0]
		headers = [normalize(h) for h in raw_headers]

		# Flexible matching for expected columns
		def find_col(names):
			for i, h in enumerate(headers):
				for n in names:
					if normalize(n) == h:
						return i
			return None

		# required fields
		name_col = find_col(["name", "full name", "student name", "student_name"])
		dob_col = find_col(["dob", "date of birth", "birthdate", "date of birth (yyyy-mm-dd)"])
		email_col = find_col(["email", "student email", "student_email", "email address"])
		sid_col = find_col(["student id", "student_id", "studentid", "id"])
		major_col = find_col(["major", "department", "faculty"])

		missing = []
		if name_col is None:
			missing.append("name / student name")
		if dob_col is None:
			missing.append("dob / date of birth")
		if email_col is None:
			missing.append("email / student email")
		if sid_col is None:
			missing.append("student id")

		if missing:
			return Response({"detail": f"Missing required columns in Excel header: {', '.join(missing)}", "found_headers": raw_headers}, status=status.HTTP_400_BAD_REQUEST)

		user_model = get_user_model()
		created = []
		updated = []
		skipped = []
		errors = []

		for idx, row in enumerate(rows[1:], start=2):
			try:
				name = row[name_col] if name_col is not None and name_col < len(row) else None
				dob_val = row[dob_col] if dob_col is not None and dob_col < len(row) else None
				email = row[email_col] if email_col is not None and email_col < len(row) else None
				student_id = row[sid_col] if sid_col is not None and sid_col < len(row) else None
				major_val = row[major_col] if major_col is not None and major_col < len(row) else None

				if not all((name, dob_val, email, student_id)):
					raise ValueError("Missing one of required fields: name, dob, email, student_id")

				# parse dob (accept date or datetime from openpyxl, or parse strings)
				from datetime import datetime, date

				if isinstance(dob_val, datetime):
					dob = dob_val.date()
				elif isinstance(dob_val, date):
					dob = dob_val
				else:
					# try parsing a string
					dob = None
					for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y", "%d-%m-%y"):
						try:
							dob = datetime.strptime(str(dob_val).strip(), fmt).date()
							break
						except Exception:
							continue
					if dob is None:
						raise ValueError(f"Could not parse dob '{dob_val}'")

				# password: student_id + dob in ddmmyy
				pwd = f"{str(student_id)}{dob.strftime('%d%m%y')}"

				# check if student already exists by student_id or email
				sid_clean = str(student_id).strip()
				email_clean = str(email).strip()
				exists_by_sid = StudentProfile.objects.filter(student_id=sid_clean).exists()
				exists_by_email = StudentProfile.objects.filter(email=email_clean).exists()
				if exists_by_sid or exists_by_email:
					# try to fetch the existing profile to include details
					existing = None
					if exists_by_sid:
						existing = StudentProfile.objects.filter(student_id=sid_clean).first()
					if not existing and exists_by_email:
						existing = StudentProfile.objects.filter(email=email_clean).first()

					skipped_item = {"row": idx, "name": str(name).strip(), "reason": "Student already exists"}
					if existing:
						try:
							skipped_item["student_id"] = existing.student_id
						except Exception:
							skipped_item["student_id"] = sid_clean
						try:
							skipped_item["dob"] = existing.dob.strftime("%Y-%m-%d") if existing.dob else None
						except Exception:
							skipped_item["dob"] = None

					skipped.append(skipped_item)
				else:
					# create user
					username = str(name).strip()
					user = user_model.objects.create_user(username=username, email=email_clean, password=pwd)
					# set role if model supports it
					try:
						user.role = "student"
						user.save()
					except Exception:
						pass

					# create student profile; set a default year=1 if not provided
					profile_kwargs = dict(user=user, name=str(name).strip(), email=email_clean, dob=dob, student_id=sid_clean, year=1)
					# attach major if provided
					try:
						if major_val:
							major_name = str(major_val).strip()
							if major_name:
								major_obj, _ = Major.objects.get_or_create(name=major_name)
								profile_kwargs['major'] = major_obj
					except Exception:
						pass

					profile = StudentProfile.objects.create(**profile_kwargs)
					profile = StudentProfile.objects.create(**profile_kwargs)
					created.append({"row": idx, "student_id": profile.student_id, "username": user.username})
					created.append({"row": idx, "student_id": profile.student_id, "username": user.username})
			except IntegrityError as ie:
				errors.append({"row": idx, "error": str(ie)})
			except Exception as e:
				errors.append({"row": idx, "error": str(e)})

		# create aggregated audit log for import
		try:
			if created:
				AuditLog.objects.create(user=request.user, action='createStudent', notes=f"Imported {len(created)} students; skipped {len(skipped)}; errors {len(errors)}")
		except Exception:
			pass

		# include updated/skipped arrays for frontend summary compatibility
		return Response({"created": created, "updated": updated, "skipped": skipped, "errors": errors}, status=status.HTTP_200_OK)


class StudentPagePagination(PageNumberPagination):
	page_size = 20
	page_size_query_param = 'page_size'


class StaffPagePagination(PageNumberPagination):
	page_size = 20
	page_size_query_param = 'page_size'


class StaffListView(generics.ListAPIView):
	"""Paginated list of staff users (tutors, academic assistants, department assistants)."""
	serializer_class = StaffSerializer
	permission_classes = (IsDAAOrAdminOrHasModelPerm,)
	pagination_class = StaffPagePagination

	def get_queryset(self):
		User = get_user_model()
		qs = User.objects.filter(role__in=("tutor", "academic_assistant", "department_assistant")).order_by('first_name')
		q = self.request.query_params.get('q')
		if q:
			qs = qs.filter(models.Q(username__icontains=q) | models.Q(email__icontains=q) | models.Q(first_name__icontains=q) | models.Q(tutor_profile__name__icontains=q) | models.Q(academic_assistant_profile__name__icontains=q) | models.Q(department_academic_assistant_profile__name__icontains=q))
		# optional filter by role (tutor | academic_assistant | department_assistant)
		role = self.request.query_params.get('role')
		if role:
			try:
				qs = qs.filter(role=role)
			except Exception:
				pass
		return qs


class StaffCreateView(generics.CreateAPIView):
	"""Create a staff user and associated minimal profile."""
	serializer_class = StaffCreateSerializer
	permission_classes = (IsDAAOrAdminOrHasModelPerm,)

	def create(self, request, *args, **kwargs):
		serializer = self.get_serializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		user = serializer.save()
		# return created user using StaffSerializer
		out = StaffSerializer(user, context={"request": request}).data
		try:
			AuditLog.objects.create(user=request.user, action='createStaff', notes=f"Created staff user {out.get('email')}")
		except Exception:
			pass
		return Response(out, status=status.HTTP_201_CREATED)


class StudentListView(generics.ListAPIView):
	"""Paginated list of students for management UI."""
	serializer_class = StudentProfileSerializer
	permission_classes = (IsDAAOrAdminOrHasModelPerm,)
	pagination_class = StudentPagePagination

	def get_queryset(self):
		qs = StudentProfile.objects.all().order_by('student_id')
		# optional search by name or student_id
		q = self.request.query_params.get('q')
		if q:
			qs = qs.filter(models.Q(name__icontains=q) | models.Q(student_id__icontains=q) | models.Q(email__icontains=q))

		# filter by year
		year = self.request.query_params.get('year')
		if year:
			try:
				y = int(year)
				qs = qs.filter(year=y)
			except Exception:
				pass

		# filter by major (accept id or name)
		major = self.request.query_params.get('major')
		if major:
			# try id first
			try:
				mid = int(major)
				qs = qs.filter(major__id=mid)
			except Exception:
				qs = qs.filter(major__name__icontains=major)

		return qs


class MajorListView(APIView):
	"""Return list of majors for frontend filters."""
	permission_classes = (IsDAAOrAdminOrHasModelPerm,)

	def get(self, request):
		majors = Major.objects.all().order_by('name')
		data = [{"id": m.id, "name": m.name} for m in majors]
		return Response(data)


class BulkPromoteView(APIView):
	"""Bulk promote selected students by one year, excluding those who cannot advance.

	POST body: { "student_ids": [1,2,3] }
	Response: { updated: <count>, promoted_ids: [...], skipped: [{id, reason}] }
	"""
	permission_classes = (IsDAAOrAdminOrHasModelPerm,)

	def post(self, request):
		data = request.data or {}
		ids = data.get('student_ids') or []
		if not isinstance(ids, (list, tuple)):
			return Response({"error": "student_ids must be a list"}, status=status.HTTP_400_BAD_REQUEST)

		MAX_YEAR = 4
		# find eligible: in ids, year < MAX_YEAR, can_advance True
		eligible_qs = StudentProfile.objects.filter(id__in=ids, year__lt=MAX_YEAR, can_advance=True)
		eligible_ids = list(eligible_qs.values_list('id', flat=True))

		# update by incrementing year
		updated_count = eligible_qs.update(year=F('year') + 1)

		promoted_ids = eligible_ids

		# compute skipped with reasons
		skipped = []
		for sid in ids:
			if sid in promoted_ids:
				continue
			try:
				sp = StudentProfile.objects.get(id=sid)
				reason = None
				if not sp.can_advance:
					reason = 'not allowed to advance'
				elif sp.year >= MAX_YEAR:
					reason = 'already at max year'
				else:
					reason = 'unknown reason'
			except StudentProfile.DoesNotExist:
				reason = 'not found'
			skipped.append({"id": sid, "reason": reason})

		# create an aggregated audit log for the promotion operation
		try:
			AuditLog.objects.create(user=request.user, action='promoteStudent', notes=f"Promoted {updated_count} students; skipped {len(skipped)}")
		except Exception:
			pass

		return Response({"updated": updated_count, "promoted_ids": promoted_ids, "skipped": skipped})

