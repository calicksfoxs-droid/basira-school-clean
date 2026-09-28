-- Apply only after the application release using finalize_lesson_asset_v2 is live.
-- This closes the former stateless finalization RPC without dropping it, so a
-- rollback can explicitly re-grant it if required.

begin;

revoke execute on function public.finalize_lesson_asset_phase13a(
  text,uuid,uuid,text,text,text,text,bigint
) from authenticated;

-- Service role does not need the legacy teacher finalization path either.
revoke execute on function public.finalize_lesson_asset_phase13a(
  text,uuid,uuid,text,text,text,text,bigint
) from service_role;

commit;
