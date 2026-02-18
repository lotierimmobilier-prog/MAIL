/*
  # Fix classification trigger for emails without ticket

  1. Problem
    - The `enqueue_email_for_classification` trigger fires on ALL email inserts
    - When an outbound email is inserted with `ticket_id = NULL` (e.g. new email not linked to a ticket),
      the trigger tries to insert into `classification_queue` with a NULL ticket_id
    - This violates the NOT NULL constraint on `classification_queue.ticket_id`

  2. Fix
    - Add a NULL check for `NEW.ticket_id` at the beginning of the trigger function
    - If ticket_id is NULL, skip classification (outbound/orphan emails don't need classification)
    - Also skip classification for outbound emails (direction = 'outbound')
*/

CREATE OR REPLACE FUNCTION enqueue_email_for_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_category_id uuid;
BEGIN
  IF NEW.ticket_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.direction = 'outbound' THEN
    RETURN NEW;
  END IF;

  SELECT category_id INTO ticket_category_id
  FROM tickets
  WHERE id = NEW.ticket_id;

  IF ticket_category_id IS NULL THEN
    INSERT INTO classification_queue (
      email_id,
      ticket_id,
      status,
      priority
    )
    VALUES (
      NEW.id,
      NEW.ticket_id,
      'pending',
      2
    )
    ON CONFLICT (email_id) WHERE status IN ('pending', 'processing')
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
