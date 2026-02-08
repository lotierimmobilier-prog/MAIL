/*
  # Réinitialiser les priorités et statuts par défaut
  
  1. Modifications
    - Met à NULL toutes les priorités des tickets existants
    - Met à NULL tous les statuts des tickets existants
    - Seuls les utilisateurs pourront définir ces valeurs manuellement
  
  2. Raison
    - Les tickets reçus par email ne doivent pas avoir de priorité/statut par défaut
    - Cela permet aux agents de gérer ces valeurs selon leur processus
*/

-- Réinitialiser toutes les priorités à NULL
UPDATE tickets SET priority = NULL WHERE priority IS NOT NULL;

-- Réinitialiser tous les statuts à NULL
UPDATE tickets SET status = NULL WHERE status IS NOT NULL;
