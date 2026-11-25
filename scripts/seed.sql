-- Jeu de démonstration pour la Voix du client.
-- 24 dossiers traités, répartis sur 10 jours, 5 thèmes, 3 langues.
-- Aucun dossier en attente : la file de validation reste propre.
-- Idempotent : les lignes seed-* sont remplacées à chaque exécution.

DELETE FROM tickets WHERE thread_id LIKE 'seed-%';

WITH seed AS (
  SELECT
    g,
    (ARRAY['P1', 'P2', 'P3'])[1 + (g % 3)] AS priority,
    (ARRAY['ponctualité', 'propreté', 'sécurité', 'abonnement', 'information'])[1 + (g % 5)] AS theme,
    (ARRAY['fr', 'ar', 'en'])[1 + (g % 3)] AS locale,
    (ARRAY[
      'Retard répété sur la ligne 1 le matin',
      'Rame sale et sièges dégradés',
      'Agression verbale à la station Casa Port',
      'Abonnement étudiant non renouvelé',
      'Demande d''information sur les horaires d''hiver'
    ])[1 + (g % 5)] AS user_query,
    CASE
      WHEN g % 4 = 0 THEN 'ligne 1'
      WHEN g % 4 = 1 THEN 'ligne 2'
      WHEN g % 4 = 2 THEN 'ligne 3'
      ELSE NULL
    END AS line,
    now()
      - ((ARRAY[0,0,0,0,1,1,1,2,2,2,3,3,4,4,4,4,5,6,6,7,7,8,8,9])[g] * interval '1 day')
      - ((g * 3 % 12) * interval '1 hour') AS created_at
  FROM generate_series(1, 24) AS g
)
INSERT INTO tickets
  (number, status, priority, theme, sentiment, line, locale, thread_id,
   user_query, draft, created_at, sla_deadline, resolved_at, csat_score, csat_at)
SELECT
  'CM-2026-' || lpad((200 + g)::text, 6, '0'),
  CASE WHEN g % 6 = 0 THEN 'rejected' ELSE 'resolved' END,
  priority,
  theme,
  CASE WHEN theme = 'information' THEN 'neutral' ELSE 'negative' END,
  line,
  locale,
  'seed-' || g,
  user_query,
  'Brouillon de démonstration, validé pour le jeu VoC.',
  created_at,
  created_at + interval '72 hours',
  CASE WHEN g % 6 = 0 THEN NULL ELSE created_at + interval '4 hours' END,
  CASE WHEN g % 6 = 0 THEN NULL WHEN g % 2 = 0 THEN 5 ELSE 4 END,
  CASE WHEN g % 6 = 0 THEN NULL ELSE created_at + interval '26 hours' END
FROM seed
ON CONFLICT (number) DO NOTHING;
