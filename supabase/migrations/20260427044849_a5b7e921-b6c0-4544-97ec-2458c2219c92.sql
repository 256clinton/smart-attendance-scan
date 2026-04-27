
-- Drop recursive policies
DROP POLICY IF EXISTS "Enrolled students view courses" ON public.courses;
DROP POLICY IF EXISTS "Lecturers manage enrollments for own courses" ON public.enrollments;

-- Security definer helpers to break recursion
CREATE OR REPLACE FUNCTION public.is_enrolled(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = _user_id AND course_id = _course_id
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = _course_id AND lecturer_id = _user_id
  )
$$;

-- Recreate non-recursive policies
CREATE POLICY "Enrolled students view courses"
ON public.courses
FOR SELECT
TO authenticated
USING (public.is_enrolled(auth.uid(), id));

CREATE POLICY "Lecturers manage enrollments for own courses"
ON public.enrollments
FOR ALL
TO authenticated
USING (public.owns_course(auth.uid(), course_id))
WITH CHECK (public.owns_course(auth.uid(), course_id));
