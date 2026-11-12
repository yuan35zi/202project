-- 002: 递补补位后的个人确认截止时间（PRD R10：补位成功后须在 2 小时内确认）
-- NULL 表示沿用本轮双选窗口；非空表示补位时刻 + 2 小时（且不晚于本轮结束）。

ALTER TABLE nominations ADD COLUMN deadline INTEGER;

CREATE INDEX IF NOT EXISTS idx_nomination_deadline
  ON nominations(deadline) WHERE deadline IS NOT NULL;
