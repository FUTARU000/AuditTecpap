-- Full-text search support for controlled documents.
-- `searchVector` exists as a plain tsvector column (created by qms_foundation).
-- We keep it in sync with a BEFORE INSERT/UPDATE trigger and index it (GIN) for
-- ranked search. to_tsvector is STABLE (not IMMUTABLE), so a trigger is the
-- canonical PostgreSQL pattern (a GENERATED column is not allowed here).

CREATE OR REPLACE FUNCTION controlled_documents_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    to_tsvector('english',
      coalesce(NEW."title", '') || ' ' ||
      coalesce(NEW."code", '') || ' ' ||
      coalesce(NEW."description", '') || ' ' ||
      coalesce(array_to_string(NEW."keywords", ' '), '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER controlled_documents_search_vector_trigger
BEFORE INSERT OR UPDATE ON "controlled_documents"
FOR EACH ROW EXECUTE FUNCTION controlled_documents_search_vector_update();

-- Backfill any existing rows.
UPDATE "controlled_documents"
  SET "searchVector" = to_tsvector('english',
      coalesce("title", '') || ' ' ||
      coalesce("code", '') || ' ' ||
      coalesce("description", '') || ' ' ||
      coalesce(array_to_string("keywords", ' '), '')
    );

CREATE INDEX "controlled_documents_searchVector_idx"
  ON "controlled_documents" USING GIN ("searchVector");
