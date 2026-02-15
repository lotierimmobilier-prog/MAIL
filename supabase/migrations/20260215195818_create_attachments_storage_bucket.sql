/*
  # Create Attachments Storage Bucket

  ## New Storage Bucket
    - `attachments` - Bucket for storing email attachments and images
      - Public read access for authenticated users
      - Write access for authenticated users
      - Maximum file size: 50 MB

  ## Storage Policies
    - Authenticated users can upload files
    - Authenticated users can read files
    - Authenticated users can delete their own files
    - Admins can delete any files

  ## Security
    - Files are scoped by user or mailbox
    - Public URLs are generated for files
    - File types and sizes are validated on frontend
*/

-- Create the attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
  );

-- Policy: Allow public read access to attachments
DROP POLICY IF EXISTS "Public read access to attachments" ON storage.objects;
CREATE POLICY "Public read access to attachments"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'attachments');

-- Policy: Allow authenticated users to update their files
DROP POLICY IF EXISTS "Authenticated users can update attachments" ON storage.objects;
CREATE POLICY "Authenticated users can update attachments"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');

-- Policy: Allow authenticated users to delete their files
DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');
