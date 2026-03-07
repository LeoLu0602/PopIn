-- Add structured feedback columns for the new feedback survey
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  ADD COLUMN IF NOT EXISTS would_return TEXT CHECK (would_return IN ('yes', 'maybe', 'no')),
  ADD COLUMN IF NOT EXISTS open_feedback TEXT;

-- message is no longer required in the new survey flow
ALTER TABLE feedback ALTER COLUMN message DROP NOT NULL;
