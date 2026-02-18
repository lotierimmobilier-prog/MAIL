/*
  # Ajout d'index de performance pour la messagerie

  1. Index ajoutés
    - `idx_emails_mailbox_received` : Optimise le chargement des emails par boîte mail triés par date
    - `idx_tickets_mailbox_last_message` : Optimise le tri des tickets par dernière activité
    - `idx_tickets_archived_last_message` : Optimise le listing de la boîte de réception (tickets non-archivés)
    - `idx_tickets_subject_mailbox` : Optimise la recherche de threads par sujet
    - `idx_emails_in_reply_to` : Optimise le threading par In-Reply-To header
    - `idx_emails_references` : Optimise le threading par References header
    - `idx_ai_classifications_ticket` : Optimise la recherche de classifications par ticket

  2. Notes
    - Tous les index sont créés avec IF NOT EXISTS pour sécurité
    - Aucune table ou colonne modifiée
    - Index partiels utilisés quand possible pour réduire la taille
*/

CREATE INDEX IF NOT EXISTS idx_emails_mailbox_received
  ON emails(mailbox_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_mailbox_last_message
  ON tickets(mailbox_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_archived_last_message
  ON tickets(last_message_at DESC)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_tickets_subject_mailbox
  ON tickets(mailbox_id, subject);

CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to
  ON emails(in_reply_to)
  WHERE in_reply_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_emails_references
  ON emails(references_header)
  WHERE references_header IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_classifications_ticket
  ON ai_classifications(ticket_id, created_at DESC);
