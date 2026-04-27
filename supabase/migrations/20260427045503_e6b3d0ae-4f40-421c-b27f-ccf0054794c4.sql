-- Helper to find a course id by code, bypassing RLS so students can join via code
CREATE OR REPLACE FUNCTION public.find_course_by_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.courses WHERE code = _code LIMIT 1;
$$;