-- Ensure explore/feed realtime subscriptions receive postgres_changes events.
-- Safe to re-run.

do $$
begin
  begin
    alter publication supabase_realtime add table public.loops;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.loop_interactions;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.comments;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.loop_stats;
  exception when duplicate_object then null;
  end;
end $$;
