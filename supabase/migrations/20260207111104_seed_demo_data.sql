/*
  # Seed Demo Data for EmailOps

  1. Data Inserted
    - 5 categories with descriptions
    - 8 tags for ticket classification
    - 2 sample mailboxes (OVH configuration)
    - 5 email templates with variables
    - Categories: Support, Sales, Billing, Maintenance, Legal

  2. Important Notes
    - Mailbox passwords are placeholder values (not real credentials)
    - Templates use {{variable}} syntax for dynamic content
    - All data is for demonstration purposes
*/

INSERT INTO categories (name, description, color) VALUES
  ('Support', 'General customer support inquiries', '#0891B2'),
  ('Sales', 'Sales inquiries and proposals', '#10B981'),
  ('Billing', 'Invoices, payments, and billing questions', '#F59E0B'),
  ('Maintenance', 'Property maintenance and repair requests', '#3B82F6'),
  ('Legal', 'Legal correspondence and contracts', '#EF4444')
ON CONFLICT (name) DO NOTHING;

INSERT INTO tags (name, color) VALUES
  ('urgent', '#EF4444'),
  ('vip-client', '#F59E0B'),
  ('follow-up', '#3B82F6'),
  ('new-client', '#10B981'),
  ('escalated', '#EC4899'),
  ('pending-docs', '#8B5CF6'),
  ('resolved', '#6B7280'),
  ('auto-classified', '#0891B2')
ON CONFLICT (name) DO NOTHING;

INSERT INTO mailboxes (name, email_address, imap_host, imap_port, smtp_host, smtp_port, username, encrypted_password, use_tls, polling_interval_seconds, tone, signature, style_prompt)
VALUES
  (
    'Support General',
    'support@company-demo.com',
    'ssl0.ovh.net', 993,
    'ssl0.ovh.net', 465,
    'support@company-demo.com',
    'encrypted_placeholder',
    true, 60,
    'professional',
    'Best regards,\nSupport Team\nCompany Demo',
    'Reply in a professional and empathetic tone. Always acknowledge the customer concern first.'
  ),
  (
    'Commercial',
    'commercial@company-demo.com',
    'ssl0.ovh.net', 993,
    'ssl0.ovh.net', 465,
    'commercial@company-demo.com',
    'encrypted_placeholder',
    true, 120,
    'friendly',
    'Kind regards,\nCommercial Team\nCompany Demo',
    'Reply in a friendly and sales-oriented tone. Highlight benefits and next steps.'
  )
ON CONFLICT (email_address) DO NOTHING;

INSERT INTO email_templates (name, description, subject, body, variables, category_id, version) VALUES
  (
    'Welcome New Client',
    'Initial welcome email sent to new clients after onboarding',
    'Welcome to {{company_name}} - Getting Started',
    'Dear {{client_name}},

Welcome to {{company_name}}! We are delighted to have you as our client.

Your account has been set up and you can now access our services. Here are a few things to get you started:

1. Your property reference: {{lot}}
2. Your contact address: {{address}}

If you have any questions, our support team is available Monday to Friday, 9am to 6pm.

Best regards,
{{signature}}',
    ARRAY['client_name', 'company_name', 'lot', 'address', 'signature'],
    (SELECT id FROM categories WHERE name = 'Support'),
    1
  ),
  (
    'Maintenance Acknowledgment',
    'Acknowledge receipt of a maintenance request',
    'Re: Maintenance Request - {{subject}}',
    'Dear {{client_name}},

Thank you for reporting the maintenance issue at {{address}}, lot {{lot}}.

We have logged your request under reference #{{ticket_ref}} and our maintenance team will review it within 48 hours. You will receive an update once a technician has been assigned.

In case of emergency, please call our 24/7 hotline.

Best regards,
{{signature}}',
    ARRAY['client_name', 'address', 'lot', 'subject', 'ticket_ref', 'signature'],
    (SELECT id FROM categories WHERE name = 'Maintenance'),
    1
  ),
  (
    'Invoice Reminder',
    'Friendly reminder for unpaid invoices',
    'Payment Reminder - Invoice {{invoice_number}}',
    'Dear {{client_name}},

This is a friendly reminder that invoice {{invoice_number}} dated {{invoice_date}} for the amount of {{amount}} remains unpaid.

Please arrange payment at your earliest convenience. If you have already made the payment, please disregard this message.

For any billing questions, please contact our accounting department.

Best regards,
{{signature}}',
    ARRAY['client_name', 'invoice_number', 'invoice_date', 'amount', 'signature'],
    (SELECT id FROM categories WHERE name = 'Billing'),
    1
  ),
  (
    'Sales Follow-Up',
    'Follow up after an initial sales inquiry or meeting',
    'Following up on our conversation - {{subject}}',
    'Dear {{client_name}},

Thank you for your interest in our services. Following our recent conversation on {{date}}, I wanted to follow up and address any questions you may have.

As discussed, we can offer the following:
- {{offer_details}}

I would be happy to schedule a call to discuss this further. Please let me know your availability.

Kind regards,
{{signature}}',
    ARRAY['client_name', 'subject', 'date', 'offer_details', 'signature'],
    (SELECT id FROM categories WHERE name = 'Sales'),
    1
  ),
  (
    'General Acknowledgment',
    'Generic acknowledgment for any incoming email',
    'Re: {{subject}}',
    'Dear {{client_name}},

Thank you for your email. We have received your message and it has been assigned to the appropriate team member.

We aim to respond within 24 business hours. If your matter is urgent, please mention it in your reply and we will prioritize accordingly.

Best regards,
{{signature}}',
    ARRAY['client_name', 'subject', 'signature'],
    (SELECT id FROM categories WHERE name = 'Support'),
    1
  )
ON CONFLICT DO NOTHING;
