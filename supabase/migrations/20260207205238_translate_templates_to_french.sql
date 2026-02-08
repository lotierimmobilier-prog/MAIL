/*
  # Translate email templates to French

  1. Changes
    - Update all existing email templates to French language
    - Translate subject lines, bodies, names and descriptions
    
  2. Templates Updated
    - Welcome New Client → Bienvenue nouveau client
    - Maintenance Acknowledgment → Accusé de réception intervention
    - Invoice Reminder → Rappel de facture
    - Sales Follow-Up → Suivi commercial
    - General Acknowledgment → Accusé de réception général
*/

-- Update Welcome New Client template to French
UPDATE email_templates 
SET 
  name = 'Bienvenue nouveau client',
  description = 'Email de bienvenue envoyé aux nouveaux clients après inscription',
  subject = 'Bienvenue chez {{company_name}} - Pour commencer',
  body = 'Cher(e) {{client_name}},

Bienvenue chez {{company_name}} ! Nous sommes ravis de vous compter parmi nos clients.

Votre compte a été créé et vous pouvez maintenant accéder à nos services. Voici quelques informations pour bien démarrer :

1. Votre référence de lot : {{lot}}
2. Votre adresse : {{address}}

Si vous avez des questions, notre équipe support est disponible du lundi au vendredi, de 9h à 18h.

Cordialement,
{{signature}}'
WHERE name = 'Welcome New Client';

-- Update Maintenance Acknowledgment template to French
UPDATE email_templates 
SET 
  name = 'Accusé réception intervention',
  description = 'Accusé de réception d''une demande d''intervention',
  subject = 'Re: Demande d''intervention - {{subject}}',
  body = 'Cher(e) {{client_name}},

Nous vous remercions d''avoir signalé un problème au {{address}}, lot {{lot}}.

Nous avons enregistré votre demande sous la référence #{{ticket_ref}} et notre équipe d''intervention l''examinera dans les 48 heures. Vous recevrez une mise à jour dès qu''un technicien sera assigné.

En cas d''urgence, veuillez appeler notre ligne d''assistance disponible 24h/24 et 7j/7.

Cordialement,
{{signature}}'
WHERE name = 'Maintenance Acknowledgment';

-- Update Invoice Reminder template to French
UPDATE email_templates 
SET 
  name = 'Rappel de paiement',
  description = 'Rappel amical pour les factures impayées',
  subject = 'Rappel de paiement - Facture {{invoice_number}}',
  body = 'Cher(e) {{client_name}},

Nous vous rappelons que la facture {{invoice_number}} datée du {{invoice_date}} d''un montant de {{amount}} reste impayée.

Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais. Si vous avez déjà effectué le paiement, veuillez ignorer ce message.

Pour toute question concernant la facturation, n''hésitez pas à contacter notre service comptabilité.

Cordialement,
{{signature}}'
WHERE name = 'Invoice Reminder';

-- Update Sales Follow-Up template to French
UPDATE email_templates 
SET 
  name = 'Suivi commercial',
  description = 'Suivi après une demande commerciale initiale ou une réunion',
  subject = 'Suite à notre échange - {{subject}}',
  body = 'Cher(e) {{client_name}},

Je vous remercie de votre intérêt pour nos services. Suite à notre échange du {{date}}, je souhaitais faire un point et répondre à vos éventuelles questions.

Comme convenu, nous pouvons vous proposer :
- {{offer_details}}

Je reste à votre disposition pour en discuter plus en détail. N''hésitez pas à me communiquer vos disponibilités.

Cordialement,
{{signature}}'
WHERE name = 'Sales Follow-Up';

-- Update General Acknowledgment template to French
UPDATE email_templates 
SET 
  name = 'Accusé de réception général',
  description = 'Accusé de réception générique pour tout email entrant',
  subject = 'Re: {{subject}}',
  body = 'Cher(e) {{client_name}},

Nous vous remercions de votre message. Nous l''avons bien reçu et il a été transmis au membre de l''équipe concerné.

Nous nous engageons à vous répondre sous 24 heures ouvrées. Si votre demande est urgente, merci de le préciser dans votre réponse et nous la traiterons en priorité.

Cordialement,
{{signature}}'
WHERE name = 'General Acknowledgment';
