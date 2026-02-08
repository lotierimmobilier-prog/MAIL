export type UserRole = 'admin' | 'manager' | 'agent' | 'readonly';

export type TicketStatus = 'new' | 'qualify' | 'assigned' | 'in_progress' | 'waiting' | 'replied' | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type EmailDirection = 'inbound' | 'outbound';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  avatar_color: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Mailbox {
  id: string;
  name: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  encrypted_password: string;
  use_tls: boolean;
  polling_interval_seconds: number;
  style_prompt: string;
  tone: string;
  required_phrases: string[];
  forbidden_phrases: string[];
  signature: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MailboxPermission {
  id: string;
  mailbox_id: string;
  user_id: string;
  can_read: boolean;
  can_send: boolean;
  can_manage: boolean;
  created_at: string;
}

export interface Ticket {
  id: string;
  mailbox_id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category_id: string | null;
  subcategory_id: string | null;
  assignee_id: string | null;
  sla_deadline: string | null;
  due_date: string | null;
  contact_name: string;
  contact_email: string;
  thread_id: string | null;
  last_message_at: string;
  closed_at: string | null;
  archived: boolean;
  archived_at: string | null;
  is_read: boolean;
  last_read_at: string | null;
  last_read_by: string | null;
  created_at: string;
  updated_at: string;
  mailbox?: Mailbox;
  category?: Category;
  subcategory?: Subcategory;
  assignee?: Profile;
  tags?: Tag[];
  email_count?: number;
}

export interface Email {
  id: string;
  ticket_id: string;
  mailbox_id: string;
  message_id: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  from_address: string;
  from_name: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  body_text: string | null;
  body_html: string | null;
  direction: EmailDirection;
  is_draft: boolean;
  sent_at: string | null;
  received_at: string;
  created_at: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  email_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
}

export interface AiClassification {
  id: string;
  email_id: string | null;
  ticket_id: string | null;
  category: string;
  subcategory: string;
  priority: string;
  intent: string;
  sentiment: string;
  entities: Record<string, unknown>;
  recommended_actions: string[];
  suggested_assignee: string | null;
  confidence: number;
  raw_response: Record<string, unknown> | null;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  category_id: string | null;
  mailbox_id: string | null;
  variables: string[];
  is_active: boolean;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  tags?: Tag[];
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  changed_by: string | null;
  change_note: string;
  created_at: string;
}

export interface InternalNote {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  user?: Profile;
}
