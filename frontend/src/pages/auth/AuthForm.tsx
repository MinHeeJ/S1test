import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../../app/AppShell';
import { ApiError } from '../../shared/api';
import { Toast } from '../../shared/Toast';
import { getCurrentUser, login, signup } from './authApi';
import './auth.css';

type Field = 'email' | 'nickname' | 'password' | 'confirmation';
type Values = Record<Field, string>;

/** Narrow authentication form; confirmation stays local and identity is verified before navigation. */
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate();
  const registration = mode === 'signup';
  const title = registration ? '회원가입' : '로그인';
  const [values, setValues] = useState<Values>({ email: '', nickname: '', password: '', confirmation: '' });
  const [errors, setErrors] = useState<Partial<Values>>({});
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getCurrentUser().then(() => {
      if (active) navigate('/resumes', { replace: true });
    }).catch(error => {
      if (!active) return;
      if (!(error instanceof ApiError && error.status === 401)) {
        setCheckError(error instanceof Error ? error.message : '현재 사용자 확인에 실패했습니다.');
      }
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [navigate]);

  async function retryIdentity() {
    setChecking(true);
    setCheckError('');
    try {
      await getCurrentUser();
      navigate('/resumes', { replace: true });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        setCheckError(error instanceof Error ? error.message : '현재 사용자 확인에 실패했습니다.');
      }
    } finally {
      if (mounted.current) setChecking(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || checking || checkError) return;
    const next: Partial<Values> = {};
    if (!values.email) next.email = '이메일을 입력해주세요.';
    if (!values.password) next.password = '비밀번호를 입력해주세요.';
    if (registration) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = '이메일 형식을 확인해주세요.';
      const length = Array.from(values.nickname).length;
      if (length < 2 || length > 12) next.nickname = '닉네임은 2~12자여야 합니다.';
      if (Array.from(values.password).length < 8) next.password = '비밀번호는 8자 이상이어야 합니다.';
      if (values.password !== values.confirmation) next.confirmation = '비밀번호가 일치하지 않습니다.';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    setMessage('');
    try {
      const credentials = { email: values.email, password: values.password };
      if (registration) await signup({ ...credentials, nickname: values.nickname });
      else await login(credentials);
      await getCurrentUser();
      if (mounted.current) navigate('/resumes', { replace: true });
    } catch (error) {
      if (!mounted.current) return;
      const text = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
      setMessage(text);
      if (error instanceof ApiError && error.body.field
        && ['email', 'nickname', 'password'].includes(error.body.field)) {
        setErrors({ [error.body.field]: text });
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function field(name: Field, label: string, type: string, autoComplete: string, hint?: string) {
    return (
      <div className="auth-field" key={name}>
        <label htmlFor={`auth-${name}`}>{label}</label>
        <input
          id={`auth-${name}`}
          name={name}
          type={type}
          autoComplete={autoComplete}
          value={values[name]}
          disabled={pending || checking || !!checkError}
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] || hint ? `auth-${name}-help` : undefined}
          onChange={event => {
            setValues(current => ({ ...current, [name]: event.target.value }));
            setErrors(current => ({ ...current, [name]: undefined }));
          }}
        />
        {(errors[name] || hint) && (
          <span id={`auth-${name}-help`} className={errors[name] ? 'auth-error' : 'auth-hint'}>
            {errors[name] || hint}
          </span>
        )}
      </div>
    );
  }

  return (
    <AppShell>
      <section className="auth-panel" aria-labelledby="auth-title">
        <header>
          <h1 id="auth-title">{title}</h1>
          <p>{registration ? '나만의 이력서 작성을 시작하세요.' : '이력서를 이어서 작성하세요.'}</p>
        </header>
        {checking && <p role="status">현재 사용자 확인 중…</p>}
        {checkError && (
          <div className="auth-feedback" role="alert">
            <p>{checkError}</p>
            <button type="button" onClick={retryIdentity}>다시 확인</button>
          </div>
        )}
        <form noValidate onSubmit={submit} aria-busy={pending}>
          {field('email', '이메일', 'text', 'email')}
          {registration && field('nickname', '닉네임', 'text', 'nickname', '2~12자')}
          {field('password', '비밀번호', 'password', registration ? 'new-password' : 'current-password',
            registration ? '8자 이상' : undefined)}
          {registration && field('confirmation', '비밀번호 확인', 'password', 'new-password')}
          <button
            className="primary"
            type="submit"
            disabled={pending || checking || !!checkError}
            aria-busy={pending}
          >
            {pending ? `${title} 처리 중…` : title}
          </button>
        </form>
        {message && <p className="auth-error" role="alert">{message}</p>}
        <p className="auth-switch">
          {registration ? '이미 계정이 있나요? ' : '처음 사용하시나요? '}
          <Link to={registration ? '/login' : '/signup'}>{registration ? '로그인' : '회원가입'}</Link>
        </p>
      </section>
      <Toast message={message} onDismiss={() => setMessage('')} />
    </AppShell>
  );
}
