CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE users IS '가입 계정과 세션 인증에 사용하는 사용자 및 BCrypt 해시를 보관한다.';
COMMENT ON COLUMN users.updated_at IS '계정의 성공 mutation 시 애플리케이션에서 갱신';
CREATE TABLE IF NOT EXISTS resume (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    template TEXT NOT NULL CHECK (template IN ('classic', 'modern')),
    style JSONB NOT NULL,
    content JSONB NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE resume IS '사용자 소유 이력서의 스타일과 순서 있는 섹션 JSON 및 논리 삭제 상태를 보관한다.';
COMMENT ON COLUMN resume.updated_at IS '이력서 성공 mutation 시 애플리케이션에서 갱신';
CREATE INDEX IF NOT EXISTS idx_resume_user_id_deleted_updated_at
    ON resume (user_id, deleted, updated_at DESC);
CREATE TABLE IF NOT EXISTS photo (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    content_type TEXT NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE photo IS '사용자 소유 사진의 원본 바이트를 보관한다. 이력서 연결 해제 시에도 자동 삭제하지 않는다.';
CREATE INDEX IF NOT EXISTS idx_photo_user_id ON photo (user_id);
