CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE users IS '가입 계정과 BCrypt 인증 정보의 원천이다.';

CREATE TABLE IF NOT EXISTS resume (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    template TEXT NOT NULL CHECK (template IN ('classic', 'modern')),
    style JSONB NOT NULL,
    content JSONB NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE resume IS '사용자 소유 이력서의 전체 JSON 본문과 스타일을 보관한다. 삭제는 논리 삭제로 처리한다.';
COMMENT ON COLUMN resume.content IS '섹션 순서와 숨긴 데이터를 보존한다. basics.photoId는 photo.id의 논리 참조이다.';
COMMENT ON COLUMN resume.updated_at IS '성공한 이력서 변이 시 서비스에서 갱신하며 created_at은 유지한다.';
CREATE INDEX IF NOT EXISTS idx_resume_user_id_deleted_updated_at_id
    ON resume (user_id, deleted, updated_at DESC, id);

CREATE TABLE IF NOT EXISTS photo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    content_type TEXT NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE photo IS '사용자가 업로드한 사진 원본을 보관한다. 이력서 연결 해제나 논리 삭제로 물리 삭제하지 않는다.';
CREATE INDEX IF NOT EXISTS idx_photo_user_id
    ON photo (user_id);
