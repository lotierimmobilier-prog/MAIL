/*
  # Seed Demo Tickets and Emails

  1. Data Inserted
    - 6 demo tickets across different categories and statuses
    - 12 demo emails (conversations within tickets)
    - 2 AI classifications
    - Demonstrates various ticket workflow states

  2. Important Notes
    - Uses the mailboxes and categories created in previous seed
    - Emails show realistic conversation threads
    - AI classifications demonstrate the classification output format
*/

DO $$
DECLARE
  v_mailbox_id uuid;
  v_cat_support uuid;
  v_cat_billing uuid;
  v_cat_maintenance uuid;
  v_cat_sales uuid;
  v_cat_legal uuid;
  v_ticket1 uuid;
  v_ticket2 uuid;
  v_ticket3 uuid;
  v_ticket4 uuid;
  v_ticket5 uuid;
  v_ticket6 uuid;
  v_email1 uuid;
  v_email2 uuid;
  v_email3 uuid;
BEGIN
  SELECT id INTO v_mailbox_id FROM mailboxes WHERE email_address = 'support@company-demo.com' LIMIT 1;
  SELECT id INTO v_cat_support FROM categories WHERE name = 'Support' LIMIT 1;
  SELECT id INTO v_cat_billing FROM categories WHERE name = 'Billing' LIMIT 1;
  SELECT id INTO v_cat_maintenance FROM categories WHERE name = 'Maintenance' LIMIT 1;
  SELECT id INTO v_cat_sales FROM categories WHERE name = 'Sales' LIMIT 1;
  SELECT id INTO v_cat_legal FROM categories WHERE name = 'Legal' LIMIT 1;

  IF v_mailbox_id IS NULL THEN
    RAISE NOTICE 'No mailbox found, skipping ticket seed';
    RETURN;
  END IF;

  -- Ticket 1: New support request
  v_ticket1 := gen_random_uuid();
  INSERT INTO tickets (id, mailbox_id, subject, status, priority, category_id, contact_name, contact_email, last_message_at, created_at)
  VALUES (v_ticket1, v_mailbox_id, 'Unable to access tenant portal', 'new', 'high', v_cat_support, 'Marie Dupont', 'marie.dupont@email.com', now() - interval '30 minutes', now() - interval '2 hours');

  v_email1 := gen_random_uuid();
  INSERT INTO emails (id, ticket_id, mailbox_id, from_address, from_name, to_addresses, subject, body_text, direction, received_at)
  VALUES (v_email1, v_ticket1, v_mailbox_id, 'marie.dupont@email.com', 'Marie Dupont', ARRAY['support@company-demo.com'],
    'Unable to access tenant portal',
    'Hello,

I have been trying to access the tenant portal since this morning but I keep getting an error message saying "Account locked". I have not changed my password recently and I need to access my documents urgently.

My tenant reference is LOT-2024-0892.

Could you please help me resolve this as soon as possible?

Thank you,
Marie Dupont
+33 6 12 34 56 78',
    'inbound', now() - interval '2 hours');

  INSERT INTO ai_classifications (email_id, ticket_id, category, subcategory, priority, intent, sentiment, entities, recommended_actions, confidence)
  VALUES (v_email1, v_ticket1, 'Support', 'Account Access', 'high', 'request_help',
    'negative',
    '{"name": "Marie Dupont", "email": "marie.dupont@email.com", "phone": "+33 6 12 34 56 78", "property": "LOT-2024-0892"}',
    ARRAY['Unlock the tenant account', 'Send password reset link', 'Confirm access restoration'],
    0.92);

  -- Ticket 2: Billing inquiry (in progress)
  v_ticket2 := gen_random_uuid();
  INSERT INTO tickets (id, mailbox_id, subject, status, priority, category_id, contact_name, contact_email, last_message_at, created_at)
  VALUES (v_ticket2, v_mailbox_id, 'Question about December charges', 'in_progress', 'medium', v_cat_billing, 'Pierre Martin', 'p.martin@gmail.com', now() - interval '4 hours', now() - interval '1 day');

  INSERT INTO emails (ticket_id, mailbox_id, from_address, from_name, to_addresses, subject, body_text, direction, received_at)
  VALUES (v_ticket2, v_mailbox_id, 'p.martin@gmail.com', 'Pierre Martin', ARRAY['support@company-demo.com'],
    'Question about December charges',
    'Good morning,

I just received my December statement and I noticed an additional charge of 150 EUR labeled "Building renovation contribution". I was not informed about this charge beforehand.

Could you please provide details about what this charge covers and whether it was approved by the building committee?

Regards,
Pierre Martin
Apartment 3B, 15 Rue de la Paix',
    'inbound', now() - interval '1 day');

  INSERT INTO emails (ticket_id, mailbox_id, from_address, from_name, to_addresses, subject, body_text, direction, sent_at, received_at)
  VALUES (v_ticket2, v_mailbox_id, 'support@company-demo.com', 'Support Team', ARRAY['p.martin@gmail.com'],
    'Re: Question about December charges',
    'Dear Mr. Martin,

Thank you for reaching out regarding the December charges.

The "Building renovation contribution" of 150 EUR was approved during the general assembly on November 15th (resolution #12). This charge covers the facade renovation project scheduled for Q1 2025.

The detailed breakdown was included in the assembly minutes which were sent to all co-owners on November 20th. I am attaching a copy for your reference.

Please let me know if you have any further questions.

Best regards,
Support Team',
    'outbound', now() - interval '4 hours', now() - interval '4 hours');

  -- Ticket 3: Maintenance request (waiting)
  v_ticket3 := gen_random_uuid();
  INSERT INTO tickets (id, mailbox_id, subject, status, priority, category_id, contact_name, contact_email, last_message_at, created_at)
  VALUES (v_ticket3, v_mailbox_id, 'Water leak in bathroom - URGENT', 'waiting', 'urgent', v_cat_maintenance, 'Sophie Bernard', 'sophie.b@outlook.fr', now() - interval '6 hours', now() - interval '8 hours');

  v_email2 := gen_random_uuid();
  INSERT INTO emails (id, ticket_id, mailbox_id, from_address, from_name, to_addresses, subject, body_text, direction, received_at)
  VALUES (v_email2, v_ticket3, v_mailbox_id, 'sophie.b@outlook.fr', 'Sophie Bernard', ARRAY['support@company-demo.com'],
    'Water leak in bathroom - URGENT',
    'URGENT - There is a significant water leak coming from the ceiling of my bathroom. Water is dripping constantly and I have placed buckets to collect it but the situation is getting worse.

I live at 22 Avenue des Champs, Apartment 5C, lot reference LOT-2023-1456.

The leak seems to be coming from the apartment above (6C). I have tried knocking on their door but no one is home.

Please send someone as soon as possible. I am worried about water damage to my belongings.

Sophie Bernard
+33 7 98 76 54 32',
    'inbound', now() - interval '8 hours');

  INSERT INTO ai_classifications (email_id, ticket_id, category, subcategory, priority, intent, sentiment, entities, recommended_actions, confidence)
  VALUES (v_email2, v_ticket3, 'Maintenance', 'Water Leak', 'urgent', 'emergency_request',
    'negative',
    '{"name": "Sophie Bernard", "email": "sophie.b@outlook.fr", "phone": "+33 7 98 76 54 32", "address": "22 Avenue des Champs, Apt 5C", "property": "LOT-2023-1456"}',
    ARRAY['Dispatch emergency plumber immediately', 'Contact apartment 6C owner', 'Document damage for insurance', 'Follow up within 2 hours'],
    0.97);

  INSERT INTO emails (ticket_id, mailbox_id, from_address, from_name, to_addresses, subject, body_text, direction, sent_at, received_at)
  VALUES (v_ticket3, v_mailbox_id, 'support@company-demo.com', 'Support Team', ARRAY['sophie.b@outlook.fr'],
    'Re: Water leak in bathroom - URGENT',
    'Dear Ms. Bernard,

We have received your urgent maintenance request and are treating it as a priority.

An emergency plumber (Plomberie Express) has been dispatched and should arrive within the next 2 hours. We have also contacted the owner of apartment 6C.

In the meantime, please:
1. Turn off the water supply valve if accessible
2. Move any valuable items away from the affected area
3. Take photos of the damage for insurance purposes

We will keep you updated on the progress.

Best regards,
Support Team',
    'outbound', now() - interval '6 hours', now() - interval '6 hours');

  -- Ticket 4: Sales inquiry (qualified)
  v_ticket4 := gen_random_uuid();
  INSERT INTO tickets (id, mailbox_id, subject, status, priority, category_id, contact_name, contact_email, last_message_at, created_at)
  VALUES (v_ticket4, v_mailbox_id, 'Interest in property management services', 'qualify', 'medium', v_cat_sales, 'Jean-Luc Moreau', 'jl.moreau@business.fr', now() - interval '1 day', now() - interval '2 days');

  INSERT INTO emails (ticket_id, mailbox_id, from_address, from_name, to_addresses, subject, body_text, direction, received_at)
  VALUES (v_ticket4, v_mailbox_id, 'jl.moreau@business.fr', 'Jean-Luc Moreau', ARRAY['commercial@company-demo.com'],
    'Interest in property management services',
    'Hello,

I am the owner of a residential building with 24 apartments located at 45 Boulevard Haussmann, Paris 8th. I am currently looking for a new property management company.

Could you provide me with:
- Your fee structure
- Services included in the standard package
- References from similar buildings
- Timeline for transition from our current manager

The building has a gym, parking garage, and a concierge service that need to be managed.

Looking forward to your response.

Best regards,
Jean-Luc Moreau
Moreau Investments SAS
+33 1 45 67 89 00',
    'inbound', now() - interval '2 days');

  -- Ticket 5: Legal matter (assigned)
  v_ticket5 := gen_random_uuid();
  INSERT INTO tickets (id, mailbox_id, subject, status, priority, category_id, contact_name, contact_email, last_message_at, created_at)
  VALUES (v_ticket5, v_mailbox_id, 'Notice of lease termination - Apartment 2A', 'assigned', 'high', v_cat_legal, 'Cabinet Durand Avocats', 'contact@durand-avocats.fr', now() - interval '3 hours', now() - interval '5 hours');

  INSERT INTO emails (ticket_id, mailbox_id, from_address, from_name, to_addresses, subject, body_text, direction, received_at)
  VALUES (v_ticket5, v_mailbox_id, 'contact@durand-avocats.fr', 'Cabinet Durand Avocats', ARRAY['support@company-demo.com'],
    'Notice of lease termination - Apartment 2A',
    'Dear Property Manager,

On behalf of our client Mr. Robert Lefevre, tenant of Apartment 2A at 10 Rue Victor Hugo (LOT-2022-0345), we hereby give formal notice of lease termination effective March 31, 2025, in accordance with Article 15 of Law 89-462.

Please acknowledge receipt of this notice and confirm the procedure for:
1. Final inspection scheduling
2. Security deposit refund timeline
3. Outstanding charges settlement

We expect a response within 5 business days.

Regards,
Me. Claire Durand
Cabinet Durand Avocats
12 Place Vendome, 75001 Paris',
    'inbound', now() - interval '5 hours');

  -- Ticket 6: Closed resolved ticket
  v_ticket6 := gen_random_uuid();
  INSERT INTO tickets (id, mailbox_id, subject, status, priority, category_id, contact_name, contact_email, last_message_at, closed_at, created_at)
  VALUES (v_ticket6, v_mailbox_id, 'Request for parking space change', 'closed', 'low', v_cat_support, 'Alice Petit', 'alice.petit@mail.com', now() - interval '3 days', now() - interval '2 days', now() - interval '5 days');

  INSERT INTO emails (ticket_id, mailbox_id, from_address, from_name, to_addresses, subject, body_text, direction, received_at)
  VALUES (v_ticket6, v_mailbox_id, 'alice.petit@mail.com', 'Alice Petit', ARRAY['support@company-demo.com'],
    'Request for parking space change',
    'Hello,

I would like to request a change of parking space. My current space (P-12) is too narrow for my new car. Is space P-25 available?

Thank you,
Alice Petit',
    'inbound', now() - interval '5 days');

  INSERT INTO emails (ticket_id, mailbox_id, from_address, from_name, to_addresses, subject, body_text, direction, sent_at, received_at)
  VALUES (v_ticket6, v_mailbox_id, 'support@company-demo.com', 'Support Team', ARRAY['alice.petit@mail.com'],
    'Re: Request for parking space change',
    'Dear Ms. Petit,

Good news! Parking space P-25 is available and we have processed your request. The change will be effective from January 1st.

Your new parking badge has been updated. Please collect the new sticker from the concierge.

Best regards,
Support Team',
    'outbound', now() - interval '3 days', now() - interval '3 days');

END $$;
