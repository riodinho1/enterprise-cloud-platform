-- audit_events is append-only (requirement L4).
-- A row-level trigger rejects UPDATE and DELETE no matter which database role runs
-- them, so the guarantee travels with the schema. TRUNCATE is not a row operation and
-- stays available to the table owner, which the test suite relies on. Phase 5 adds a
-- second layer: the application connects as a role without UPDATE/DELETE grants.
CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
