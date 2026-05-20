-- Enable realtime on user_profile so drivers receive admin status changes instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profile;
