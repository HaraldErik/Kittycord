-- Kittycord badges: the only personal data stored is the Discord user ID (a public snowflake),
-- the public Discord flags used to verify real badges, and which badges the user chose to show.
-- No Discord tokens, usernames, e-mails or IPs are ever stored.

CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,          -- Discord snowflake
    public_flags INTEGER NOT NULL DEFAULT 0,
    premium_type INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS badges (
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, badge_id)
);

-- Only the SHA-256 of the session token is stored, so a database leak can't be used to log in.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- A login attempt started by a client. Short lived, single use.
CREATE TABLE IF NOT EXISTS auth_requests (
    id               TEXT PRIMARY KEY,      -- public handle the client polls with
    state            TEXT NOT NULL UNIQUE,  -- OAuth state (secret, only in the browser URL)
    challenge        TEXT NOT NULL,         -- SHA-256(verifier); verifier never leaves the client until claim
    user_code        TEXT NOT NULL,         -- shown in the client, typed into the confirmation page
    status           TEXT NOT NULL DEFAULT 'pending', -- pending -> authorized -> confirmed
    user_id          TEXT,
    public_flags     INTEGER,
    premium_type     INTEGER,
    code_attempts    INTEGER NOT NULL DEFAULT 0,
    expires_at       INTEGER NOT NULL
);
