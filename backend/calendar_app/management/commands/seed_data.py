from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from faker import Faker
import random
from datetime import timedelta, date, time, datetime

from calendar_app.models import Major, Course, Room, ScheduledEvent
from users.models import StudentProfile, TutorProfile

User = get_user_model()

fake = Faker()


def random_date(start_days=1, end_days=90):
    start = date.today() + timedelta(days=start_days)
    end = date.today() + timedelta(days=end_days)
    return fake.date_between_dates(date_start=start, date_end=end)


def random_time(start_hour=7, end_hour=18):
    hour = random.randint(start_hour, end_hour - 1)
    minute = random.choice([0, 0, 0, 15, 30, 45])
    return time(hour=hour, minute=minute)


class Command(BaseCommand):
    help = "Seed the database with mock majors, courses, rooms, students, tutors and scheduled events."

    def add_arguments(self, parser):
        parser.add_argument("--majors", type=int, default=3)
        parser.add_argument("--courses", type=int, default=12)
        parser.add_argument("--rooms", type=int, default=6)
        parser.add_argument("--students", type=int, default=50)
        parser.add_argument("--tutors", type=int, default=8)
        parser.add_argument("--events", type=int, default=80)
        parser.add_argument("--flush", action="store_true", help="Delete existing seeded data in these models before seeding")

    @transaction.atomic
    def handle(self, *args, **options):
        majors_n = options["majors"]
        courses_n = options["courses"]
        rooms_n = options["rooms"]
        students_n = options["students"]
        tutors_n = options["tutors"]
        events_n = options["events"]
        flush = options["flush"]

        if flush:
            self.stdout.write("Flushing existing created data...")
            ScheduledEvent.objects.all().delete()
            TutorProfile.objects.all().delete()
            StudentProfile.objects.all().delete()
            Course.objects.all().delete()
            Major.objects.all().delete()
            Room.objects.all().delete()
            # This will also remove the related user accounts created for tutors/students

        self.stdout.write("Seeding majors...")
        majors = []
        major_names = [
            "Computer Science",
            "Electrical Engineering",
            "Mechanical Engineering",
            "Biotechnology",
            "Applied Mathematics",
            "Physics",
            "Chemistry",
            "Information Technology",
            "Aerospace Engineering",
            "Environmental Science",
            "Business Administration",
            "Data Science",
        ]
        for i in range(min(majors_n, len(major_names))):
            name = major_names[i]
            m, _ = Major.objects.get_or_create(name=name)
            majors.append(m)

        self.stdout.write("Seeding courses...")
        courses = []
        course_names = [
            "Introduction to Programming",
            "Data Structures and Algorithms",
            "Database Management Systems",
            "Operating Systems",
            "Computer Networks",
            "Software Engineering",
            "Artificial Intelligence",
            "Machine Learning",
            "Calculus I",
            "Calculus II",
            "Linear Algebra",
            "Discrete Mathematics",
            "Probability and Statistics",
            "Physics I",
            "Physics II",
            "General Chemistry",
            "Organic Chemistry",
            "Classical Mechanics",
            "Quantum Mechanics",
            "Thermodynamics",
            "Digital Logic Design",
            "Microprocessors",
            "Signal Processing",
            "Control Systems",
            "Web Development",
            "Mobile Application Development",
            "Cloud Computing",
            "Cybersecurity",
            "Molecular Biology",
            "Genetics",
        ]
        for i in range(min(courses_n, len(course_names))):
            name = course_names[i]
            year = random.randint(1,4)
            major = random.choice(majors) if majors else None
            c, _ = Course.objects.get_or_create(name=name, year=year, major=major)
            courses.append(c)

        self.stdout.write("Seeding rooms...")
        rooms = []
        room_prefixes = ["Building A - Room", "Building B - Room", "Lab", "Lecture Hall", "Seminar Room", "Computer Lab"]
        for i in range(rooms_n):
            prefix = random.choice(room_prefixes)
            if prefix in ["Lab", "Computer Lab"]:
                room_num = random.randint(101, 450)
            elif prefix == "Lecture Hall":
                room_num = random.randint(1, 15)
            else:
                room_num = random.randint(101, 550)
            name = f"{prefix} {room_num}"
            r, _ = Room.objects.get_or_create(name=name)
            rooms.append(r)

        self.stdout.write("Seeding tutors...")
        tutors = []
        for i in range(tutors_n):
            name = fake.name()
            email = fake.unique.email()
            tutor_id = f"T{fake.random_number(digits=5)}"
            username = email
            password = "password123"
            user = User.objects.create_user(username=username, email=email, password=password, role="tutor")
            tprofile = TutorProfile.objects.create(user=user, email=email, name=name, dob=fake.date_of_birth(minimum_age=25, maximum_age=65), tutor_id=tutor_id)
            # assign random courses
            assigned = random.sample(courses, k=max(1, min(3, len(courses))))
            for c in assigned:
                tprofile.courses.add(c)
            tutors.append(tprofile)

        self.stdout.write("Seeding students...")
        students = []
        for i in range(students_n):
            name = fake.name()
            email = fake.unique.email()
            student_id = f"S{fake.random_number(digits=7)}"
            dob = fake.date_of_birth(minimum_age=18, maximum_age=30)
            major = random.choice(majors) if majors else None
            year = random.randint(1,4)
            sp = StudentProfile(name=name, email=email, dob=dob, student_id=student_id, major=major, year=year)
            sp.save()  # StudentProfile.save creates the related user
            students.append(sp)

        self.stdout.write("Seeding scheduled events...")
        events = []
        for i in range(events_n):
            course = random.choice(courses)
            event_date = random_date(1, 120)
            start = random_time(7, 18)
            # add 1-3 hour duration
            duration = random.choice([1, 2, 3])
            end_hour = (start.hour + duration) % 24
            end = time(hour=end_hour, minute=start.minute)
            tutor = random.choice(tutors).user if tutors and random.random() > 0.3 else None
            room = random.choice(rooms)
            etype = random.choice([choice[0] for choice in ScheduledEvent.EVENT_TYPES])
            title = f"{course.name} {etype.capitalize()}"
            notes = fake.sentence() if random.random() > 0.5 else None
            se = ScheduledEvent.objects.create(
                title=title,
                date=event_date,
                course=course,
                tutor=tutor,
                start_time=start,
                end_time=end,
                room=room,
                event_type=etype,
                status=random.choice(["pending", "approved"]),
                notes=notes,
            )
            events.append(se)

        self.stdout.write("Seeding complete: events created.")

        # Create default accounts if they don't exist
        self.stdout.write("Creating default accounts...")
        
        # Admin
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("admin", "admin@example.com", "adminpass")
            self.stdout.write("Created superuser: admin/admin")
        if not User.objects.filter(username="usth").exists():
            usth = User.objects.create_user("usth", "usth@example.com", "usthpass", role="administrator")
            from users.models import AdministratorProfile
            AdministratorProfile.objects.create(user= usth, email="usth@example.com", name="USTH", admin_id="USTH001")
            self.stdout.write("Created admin: USTH")

        # DAA (Department Academic Assistant)
        if not User.objects.filter(username="daa").exists():
            daa = User.objects.create_user("daa", "daa@example.com", "daapass", role="department_assistant")
            # Create associated profile if needed (assuming model signals handle it or manual creation)
            # Check models.py for profile creation logic. unique constraints might apply.
            # Assuming basic user creation is enough for login, but profiles might be needed for logic.
            # Let's check models.py: DepartmentAcademicAssistantProfile has one-to-one with user.
            from users.models import DepartmentAcademicAssistantProfile, AcademicAssistantProfile
            DepartmentAcademicAssistantProfile.objects.create(user=daa, email="daa@example.com", name="Department Assistant", dassistant_id="DAA001")
            self.stdout.write("Created DAA: daa/daa")

        # AA (Academic Assistant)
        if not User.objects.filter(username="aa").exists():
            aa = User.objects.create_user("aa", "aa@example.com", "aapass", role="academic_assistant")
            AcademicAssistantProfile.objects.create(user=aa, email="aa@example.com", name="Academic Assistant", assistant_id="AA001")
            self.stdout.write("Created AA: aa/aa")

        self.stdout.write(self.style.SUCCESS(
            f"Seeding complete: {len(majors)} majors, {len(courses)} courses, {len(rooms)} rooms, {len(tutors)} tutors, {len(students)} students, {len(events)} events created."))
