import type { ReactNode } from 'react';
import { Header, type HeaderProps } from '../shared/Header';

export function AppShell({ children, toolbar, ...header }: HeaderProps & {
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 이동</a>
      <Header {...header} />
      {toolbar && <div className="editor-toolbar">{toolbar}</div>}
      <main id="main-content">{children}</main>
    </div>
  );
}
