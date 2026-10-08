CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE users IS '가입 계정과 세션 인증에 사용하는 사용자 원천.';
COMMENT ON COLUMN users.updated_at IS '가입 및 계정 쓰기 service가 성공 transaction 내 갱신';
CREATE TABLE IF NOT EXISTS resume (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    template TEXT NOT NULL CHECK (template IN ('classic', 'modern')),
    style JSONB NOT NULL,
    content JSONB NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE resume IS '사용자 소유 이력서의 본문과 스타일 및 논리 삭제 상태.';
COMMENT ON COLUMN resume.updated_at IS '이력서 쓰기 service가 성공 transaction 내 갱신';
CREATE INDEX IF NOT EXISTS resume_owner_active_updated_idx
    ON resume (user_id, deleted, updated_at DESC);
CREATE TABLE IF NOT EXISTS photo (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    content_type TEXT NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE photo IS '본인 이력서에 연결할 사진의 원본 바이너리. 연결 해제는 본문 photoId를 null로 저장한다.';
CREATE INDEX IF NOT EXISTS photo_owner_idx
    ON photo (user_id);
