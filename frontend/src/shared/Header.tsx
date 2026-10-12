export interface HeaderProps {
  nickname?: string;
  onLogout?: () => void | Promise<void>;
  pending?: boolean;
}

export function Header({ nickname, onLogout, pending = false }: HeaderProps) {
  return (
    <header className="identity-header">
      <span className="brand">ResumeCraft</span>
      {nickname !== undefined && (
        <div className="account">
          <span>{nickname}</span>
          <button type="button" onClick={onLogout} disabled={pending} aria-busy={pending}>
            로그아웃
          </button>
        </div>
      )}
    </header>
  );
}
