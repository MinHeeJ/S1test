CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE users IS '세션 인증과 가입에 사용하는 사용자 계정.';
CREATE TABLE IF NOT EXISTS resume (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    template TEXT NOT NULL CHECK (template IN ('classic', 'modern')),
    style JSONB NOT NULL CHECK (jsonb_typeof(style) = 'object'),
    content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'array'),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE resume IS '본인 이력서의 본문과 스타일을 보관하며 삭제 후에도 행을 보존한다.';
COMMENT ON COLUMN resume.content IS 'photoId는 photo.id 논리 참조이며 저장 서비스가 소유·존재를 검사한다.';
CREATE INDEX IF NOT EXISTS idx_resume_user_deleted_updated_at
    ON resume (user_id, deleted, updated_at DESC, id ASC);
CREATE TABLE IF NOT EXISTS photo (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
    data BYTEA NOT NULL CHECK (octet_length(data) <= 2000000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE photo IS '사용자가 업로드한 사진 원본을 보관한다. 연결 해제는 물리 삭제가 아니다.';
CREATE INDEX IF NOT EXISTS idx_photo_user_id ON photo (user_id);
