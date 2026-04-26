-- Roles enum and user_roles table (separate from profiles for security)
CREATE TYPE public.app_role AS ENUM ('lecturer', 'student');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  university_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lecturer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lecturer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL DEFAULT 'Lecture',
  scan_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, university_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'university_id'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student'::app_role)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles policies
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Courses policies
CREATE POLICY "Lecturers manage own courses"
  ON public.courses FOR ALL TO authenticated
  USING (auth.uid() = lecturer_id)
  WITH CHECK (auth.uid() = lecturer_id AND public.has_role(auth.uid(), 'lecturer'));

CREATE POLICY "Enrolled students view courses"
  ON public.courses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.course_id = courses.id AND enrollments.student_id = auth.uid()
  ));

-- Enrollments policies
CREATE POLICY "Lecturers manage enrollments for own courses"
  ON public.enrollments FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = enrollments.course_id AND courses.lecturer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = enrollments.course_id AND courses.lecturer_id = auth.uid()
  ));

CREATE POLICY "Students view own enrollments"
  ON public.enrollments FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students self-enroll"
  ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'));

-- Sessions policies
CREATE POLICY "Lecturers manage own sessions"
  ON public.sessions FOR ALL TO authenticated
  USING (auth.uid() = lecturer_id)
  WITH CHECK (auth.uid() = lecturer_id AND public.has_role(auth.uid(), 'lecturer'));

CREATE POLICY "Enrolled students view sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.course_id = sessions.course_id AND enrollments.student_id = auth.uid()
  ));

-- Attendance policies
CREATE POLICY "Students record own attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND public.has_role(auth.uid(), 'student')
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.enrollments e ON e.course_id = s.course_id
      WHERE s.id = attendance.session_id
        AND e.student_id = auth.uid()
        AND s.expires_at > now()
    )
  );

CREATE POLICY "Students view own attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Lecturers view attendance for own sessions"
  ON public.attendance FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sessions WHERE sessions.id = attendance.session_id AND sessions.lecturer_id = auth.uid()
  ));
