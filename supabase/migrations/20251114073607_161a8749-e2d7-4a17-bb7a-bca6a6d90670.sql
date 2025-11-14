-- Add health profile fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS pre_existing_conditions TEXT[],
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add delete policy for symptom_analyses
CREATE POLICY "Users can delete own analyses"
ON public.symptom_analyses
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger to update profiles updated_at
CREATE OR REPLACE FUNCTION public.update_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_updated_at();