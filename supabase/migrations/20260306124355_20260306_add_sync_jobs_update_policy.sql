/*
  # Add UPDATE policy for sync_jobs

  ## Problem
  - sync_jobs table had no UPDATE policy for service role
  - Edge functions could not update job status, progress, or error messages
  - Sync operations would fail silently when trying to record results

  ## Solution
  - Add PERMISSIVE UPDATE policy allowing service_role to update sync jobs
  - This enables the sync functions to properly update job status and progress

  ## Security
  - Policy is limited to service_role which is only used by backend functions
  - Authenticated users still cannot directly update sync jobs
*/

CREATE POLICY "Service role can update sync jobs"
  ON sync_jobs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
