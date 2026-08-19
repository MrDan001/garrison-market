-- Keep the privileged RLS event-trigger function available to the database,
-- but prevent public API roles from invoking it directly.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
