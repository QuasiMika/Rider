-- Guests never need to UPDATE their own guest_requests rows:
-- cancelling uses DELETE, re-booking uses INSERT via the create-request edge function.
-- The open UPDATE policy allowed a guest to manipulate price_eur between request
-- creation and driver acceptance, letting them pay less than the calculated fare.
DROP POLICY IF EXISTS "Guest update own requests" ON public.guest_requests;
