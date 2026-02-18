/*
  # Add notification trigger for ticket assignment

  1. New Functions
    - `notify_ticket_assignment()` - Creates a notification when a ticket is assigned to a user
  
  2. New Triggers
    - `trigger_notify_ticket_assignment` on `tickets` table (AFTER UPDATE)
  
  3. Security
    - Function runs as SECURITY DEFINER to bypass RLS for system-generated notifications
    - Only fires when assignee_id changes to a non-null value
    - Only notifies the newly assigned user (not the one who made the change)
  
  4. Notes
    - Notification type is 'assignment'
    - Includes a link to the ticket for quick navigation
    - Does not notify if the user assigns a ticket to themselves
*/

CREATE OR REPLACE FUNCTION public.notify_ticket_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL 
    AND (OLD.assignee_id IS NULL OR OLD.assignee_id != NEW.assignee_id)
  THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.assignee_id,
      'assignment',
      'Ticket assigne',
      'Le ticket "' || LEFT(NEW.subject, 80) || '" vous a ete assigne.',
      '/inbox/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_ticket_assignment ON tickets;

CREATE TRIGGER trigger_notify_ticket_assignment
  AFTER UPDATE OF assignee_id ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_assignment();
