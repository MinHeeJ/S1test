CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE users IS '가입 계정과 세션 인증의 사용자 원천. 비밀번호는 BCrypt 해시만 저장한다.';
COMMENT ON COLUMN users.updated_at IS '사용자 서비스가 계정 write 성공 시 갱신한다.';

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
COMMENT ON TABLE resume IS '사용자 소유 이력서의 제목, 스타일 및 순서 있는 섹션 본문. 삭제는 논리 삭제로 처리한다.';
COMMENT ON COLUMN resume.updated_at IS '이력서 서비스가 생성, 수정, 이름 변경, 논리 삭제 성공 시 갱신한다.';
COMMENT ON COLUMN resume.content IS '순서와 숨김 데이터를 보존하는 섹션 배열. basics.photoId는 photo.id의 논리 참조이며 서비스에서 소유권을 확인한다.';
CREATE INDEX IF NOT EXISTS idx_resume_user_active_updated
    ON resume (user_id, deleted, updated_at DESC);

CREATE TABLE IF NOT EXISTS photo (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    content_type TEXT NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE photo IS '사용자 소유 JPG 또는 PNG 사진 원본. 이력서 연결 해제나 논리 삭제로 사진을 물리 삭제하지 않는다.';
CREATE INDEX IF NOT EXISTS idx_photo_user_id
    ON photo (user_id);
