/*
  # Add INSERT policy for sync_jobs

  ## Problem
  - sync_jobs table had no INSERT policy for authenticated users or service role
  - This prevented any sync operations from being recorded in the database
  - Users could view sync jobs but not create them, causing silent failures

  ## Solution
  - Add PERMISSIVE INSERT policy allowing service_role to create sync jobs
  - This enables the sync functions to properly log job creation

  ## Security
  - Policy is limited to service_role which is only used by backend functions
  - Authenticated users still cannot directly insert sync jobs (must use edge functions)
*/

CREATE POLICY "Service role can insert sync jobs"
  ON sync_jobs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
