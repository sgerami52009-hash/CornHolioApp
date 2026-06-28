-- Remove the 0-21 score constraints and the 21-to-win rule
-- Allow any non-negative score; winner is whoever scores higher

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_score_a_check;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_score_b_check;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS valid_final_score;

ALTER TABLE matches ADD CONSTRAINT matches_score_a_check CHECK (score_a >= 0);
ALTER TABLE matches ADD CONSTRAINT matches_score_b_check CHECK (score_b >= 0);
ALTER TABLE matches ADD CONSTRAINT valid_final_score CHECK (
  status <> 'complete'
  OR is_bye
  OR (score_a <> score_b)
);
