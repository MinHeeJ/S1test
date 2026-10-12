CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    nickname text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE users IS '가입과 세션 인증의 사용자 계정. 비밀번호는 BCrypt 해시로만 보관한다.';

CREATE TABLE IF NOT EXISTS resume (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title text NOT NULL,
    template text NOT NULL CHECK (template IN ('classic', 'modern')),
    style jsonb NOT NULL,
    content jsonb NOT NULL,
    deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE resume IS '사용자 소유 이력서와 섹션 원문을 보관하며 삭제는 deleted로 표시한다.';
COMMENT ON COLUMN resume.content IS '내장 섹션 배열; basics.photoId는 photo.id의 논리 참조이며 물리 FK가 아니다.';
COMMENT ON COLUMN resume.updated_at IS '이력서 명령 서비스가 성공한 PUT/PATCH/삭제 시 UTC 시각으로 갱신한다.';

CREATE TABLE IF NOT EXISTS photo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
    data bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE photo IS '본인 사진의 JPEG/PNG 원본을 보관한다. 연결 해제와 이력서 삭제로 자동 정리하지 않는다.';

CREATE INDEX IF NOT EXISTS idx_resume_user_deleted_updated
    ON resume (user_id, deleted, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_photo_user_id
    ON photo (user_id);
