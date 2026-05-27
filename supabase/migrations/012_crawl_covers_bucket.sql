-- Storage bucket for user-uploaded crawl cover images.
-- Path convention: <user_id>/<crawl_id>/<filename>
-- Anyone can read; only the owning user can write/update/delete their files.

INSERT INTO storage.buckets (id, name, public)
VALUES ('crawl-covers', 'crawl-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Crawl covers: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'crawl-covers');

CREATE POLICY "Crawl covers: owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'crawl-covers'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Crawl covers: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'crawl-covers'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Crawl covers: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'crawl-covers'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
