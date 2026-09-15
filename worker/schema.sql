CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  platform TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS scores_score_idx ON scores (score DESC, created_at ASC);

-- Aggregate visit + play counters (cookieless; no IPs, no user rows).
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO counters (name, value) VALUES ('visits', 0);

INSERT OR IGNORE INTO counters (name, value) VALUES ('plays_solo', 0);
INSERT OR IGNORE INTO counters (name, value) VALUES ('plays_local', 0);
INSERT OR IGNORE INTO counters (name, value) VALUES ('plays_online', 0);

INSERT OR IGNORE INTO counters (name, value) VALUES ('plays_online_queue', 0);
