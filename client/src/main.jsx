import React, { createContext, useContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import './index.css';
import { isChangePasswordFormValid } from './changePasswordValidation.js';
import { mergeAuthSession } from './authSession.js';
import { clearAdminSession, getAdminDashboardControls } from './adminUx.js';
import { getAdminLoginRedirect, getLoginRedirect, getRootRedirect } from './authRouting.js';
import { buildResetPasswordPayload, getResetTokenFromSearchParams } from './resetPasswordHelpers.js';
import { getChangePasswordNavigationItems, getResetPasswordFieldLabels } from './authUx.js';
import { restoreSessionOnce } from './sessionRestore.js';
import { broadcastLogout, broadcastSessionState, listenSessionState } from './sessionSync.js';

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:5500');

async function request(path, { method = 'GET', body, csrfToken, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function refreshSessionRequest() {
  return request('/api/auth/refresh', { method: 'POST' });
}

const AuthContext = createContext(null);
function useAuth() { return useContext(AuthContext); }

function AuthProvider({ children }) {
  const [state, setState] = useState({ accessToken: '', csrfToken: '', user: null, ready: false });
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = listenSessionState(
      (session) => {
        setState((prev) => mergeAuthSession(prev, session));
      },
      () => {
        setState((prev) => mergeAuthSession(prev, { accessToken: '', csrfToken: '', user: null }));
      }
    );
    (async () => {
      try {
        const data = await restoreSessionOnce(refreshSessionRequest);
        if (!cancelled && data.accessToken) {
          setState((prev) => mergeAuthSession(prev, { accessToken: data.accessToken, csrfToken: data.csrfToken || prev.csrfToken, user: data.user || prev.user }));
          return;
        }
      } catch {
        // Fall through to logged-out ready state.
      }
      if (!cancelled) setState((prev) => mergeAuthSession(prev, {}));
    })();
    return () => { cancelled = true; unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ state, setState }}>{children}</AuthContext.Provider>;
}

function Shell({ title, children, footer }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"><h2 className="mb-4 text-2xl font-medium">{title}</h2>{children}{footer}</section>;
}

function Input({ label, ...props }) {
  return <label className="block"><span className="mb-1 block text-sm text-slate-300">{label}</span><input {...props} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400" /></label>;
}

function Button(props) {
  return <button {...props} className={`rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-60 ${props.className || ''}`.trim()} />;
}

function Message({ text, error }) {
  if (!text) return null;
  return <div className={`mb-4 rounded-lg p-3 text-sm ${error ? 'bg-rose-950 text-rose-200' : 'bg-emerald-950 text-emerald-200'}`}>{text}</div>;
}

function RedirectByRole() {
  const auth = useAuth();
  const target = getRootRedirect(auth.state);
  if (!auth.state.ready) return <Shell title="Loading"><p>Restoring session...</p></Shell>;
  return <Navigate to={target} replace />;
}

function PublicLoginGate({ children }) {
  const auth = useAuth();
  const location = useLocation();
  const target = location.pathname === '/admin/login' ? getAdminLoginRedirect(auth.state) : getLoginRedirect(auth.state);
  if (!auth.state.ready) return <Shell title="Loading"><p>Restoring session...</p></Shell>;
  if (target) return <Navigate to={target} replace />;
  return children;
}

function UserProtectedRoute({ children }) {
  const auth = useAuth();
  if (!auth.state.ready) return <Shell title="Loading"><p>Restoring session...</p></Shell>;
  if (!auth.state.accessToken) return <Navigate to="/login" replace />;
  if (auth.state.user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function AdminProtectedRoute({ children }) {
  const auth = useAuth();
  if (!auth.state.ready) return <Shell title="Loading"><p>Restoring session...</p></Shell>;
  if (!auth.state.accessToken) return <Navigate to="/admin/login" replace />;
  if (auth.state.user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>;
}

function AppRoutes() {
  const auth = useAuth();
  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">JWT Auth Demo</h1>
        <p className="text-slate-400">Secure registration, verification, JWT login, reset, and a read-only admin demo.</p>
      </header>
      <Routes>
        <Route path="/" element={<RedirectByRole />} />
        <Route path="/login" element={<PublicLoginGate><Login /></PublicLoginGate>} />
        <Route path="/register" element={<PublicPage><Register /></PublicPage>} />
        <Route path="/register-success" element={<PublicPage><RegisterSuccess /></PublicPage>} />
        <Route path="/verify-email" element={<PublicPage><VerifyEmail /></PublicPage>} />
        <Route path="/verify-expired" element={<PublicPage><VerificationExpired /></PublicPage>} />
        <Route path="/forgot-password" element={<PublicPage><ForgotPassword /></PublicPage>} />
        <Route path="/reset-password" element={<PublicPage><ResetPassword /></PublicPage>} />
        <Route path="/dashboard" element={<UserProtectedRoute><Panel /></UserProtectedRoute>} />
        <Route path="/change-password" element={<UserProtectedRoute><ChangePassword /></UserProtectedRoute>} />
        <Route path="/admin/login" element={<PublicLoginGate><AdminLogin /></PublicLoginGate>} />
        <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  </div>;
}

function PublicPage({ children }) { return children; }

function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return <Shell title="Login"><Message text={msg} error /><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setMsg(''); try { const data = await request('/api/auth/login', { method: 'POST', body: form }); auth.setState((prev) => mergeAuthSession(prev, data)); broadcastSessionState(data); navigate('/dashboard', { replace: true }); } catch (err) { setMsg(err.message); } finally { setBusy(false); } }} className="space-y-4"><Input label="Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><div className="flex flex-wrap gap-3"><Button disabled={busy}>{busy ? 'Signing in...' : 'Login'}</Button><Link className="text-cyan-300" to="/forgot-password">Forgot Password</Link><Link className="text-cyan-300" to="/register">Registration</Link><Link className="text-cyan-300" to="/admin/login">Admin Login</Link></div></form></Shell>;
}

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', gender: '', address: '', password: '', repeatPassword: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return <Shell title="Registration"><Message text={msg} error /><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setMsg(''); try { const result = await request('/api/auth/register', { method: 'POST', body: form }); sessionStorage.setItem('verificationEmail', form.email); navigate(`/register-success?email=${encodeURIComponent(result.email)}`, { replace: true }); } catch (err) { setMsg(err.message); } finally { setBusy(false); } }} className="grid gap-4 md:grid-cols-2">
    <Input label="First Name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
    <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
    <Input label="Email Address *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
    <Input label="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
    <Input label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
    <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
    <Input label="Password *" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
    <Input label="Repeat Password *" type="password" value={form.repeatPassword} onChange={(e) => setForm({ ...form, repeatPassword: e.target.value })} />
    <div className="md:col-span-2"><Button disabled={busy}>{busy ? 'Creating account...' : 'Register'}</Button></div>
  </form></Shell>;
}

function RegisterSuccess() {
  const [searchParams] = useSearchParams();
  const maskedEmail = searchParams.get('email') || 'your email address';
  return <Shell title="Registration Successful"><div className="space-y-3"><p>A verification email has been sent to {maskedEmail}.</p><p>Please check your inbox and click the verification link to activate your account.</p><p>If you do not see the email, please check your spam or junk folder.</p><p>The verification link expires in 15 minutes.</p><p>If appropriate, the sender address is: auth.signalgrowth@gmail.com</p><div className="flex gap-3"><Link className="text-cyan-300" to="/login">Continue to Login</Link><Link className="text-cyan-300" to={`/verify-expired?email=${encodeURIComponent(sessionStorage.getItem('verificationEmail') || '')}`}>Resend Verification Email</Link></div></div></Shell>;
}

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ text: 'Verifying...' });
  useEffect(() => { (async () => { const token = searchParams.get('token'); if (!token) return setState({ text: 'Verification failed. Please request a new verification link.', error: true }); try { const data = await request('/api/auth/verify-email', { method: 'POST', body: { token } }); if (data.status === 'ok') return setState({ text: 'Email verified successfully.' }); if (data.status === 'expired') return setState({ text: 'Verification link expired.', error: true }); setState({ text: 'Verification failed. Please request a new verification link.', error: true }); } catch { setState({ text: 'Verification failed. Please request a new verification link.', error: true }); } })(); }, [searchParams]);
  return <Shell title="Email Verification"><Message text={state.text} error={state.error} /><div className="flex gap-3"><Link className="text-cyan-300" to="/login">Continue to Login</Link><Link className="text-cyan-300" to="/register">Send New Verification Link</Link></div></Shell>;
}

function VerificationExpired() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [msg, setMsg] = useState('');
  return <Shell title="Verification link expired."><Message text={msg} error /><div className="space-y-4"><p>Verification link expired.</p><div className="flex gap-3"><Link className="text-cyan-300" to="/login">Continue to Login</Link><button className="text-cyan-300" onClick={async () => { await request('/api/auth/resend-verification', { method: 'POST', body: { email } }); setMsg('A new verification email has been sent.'); }}>Send New Verification Link</button></div></div></Shell>;
}

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  return <Shell title="Forgot Password"><Message text={msg} /><form onSubmit={async (e) => { e.preventDefault(); await request('/api/auth/forgot-password', { method: 'POST', body: { email } }); setMsg('If the account exists, a reset link has been sent.'); }} className="space-y-4"><Input label="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} /><Button>Send Reset Link</Button></form></Shell>;
}

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = getResetTokenFromSearchParams(searchParams);
  const labels = getResetPasswordFieldLabels();
  const [form, setForm] = useState({ password: '', repeatPassword: '' });
  const [msg, setMsg] = useState('');
  const [validState, setValidState] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setValidState('invalid'); return; }
      try {
        const data = await request('/api/auth/reset-password/validate', { method: 'POST', body: { token } });
        if (!cancelled) setValidState(data.status === 'ok' ? 'valid' : data.status);
      } catch {
        if (!cancelled) setValidState('invalid');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);
  if (validState === 'loading') return <Shell title="Reset Password"><p>Checking reset link...</p></Shell>;
  if (validState !== 'valid') {
    return <Shell title="Reset Password"><Message text="This password reset link is invalid, expired, or has already been used." error /><div className="flex gap-3"><Link className="text-cyan-300" to="/forgot-password">Request a New Reset Link</Link></div></Shell>;
  }
  return <Shell title="Reset Password"><Message text={msg} error={msg.includes('invalid') || msg.includes('expired')} /><form onSubmit={async (e) => { e.preventDefault(); const data = await request('/api/auth/reset-password', { method: 'POST', body: buildResetPasswordPayload(form, token) }); setMsg(data.status === 'ok' ? 'Password reset successfully.' : 'This password reset link is invalid, expired, or has already been used.'); }} className="space-y-4"><Input label={labels[0]} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><Input label={labels[1]} type="password" value={form.repeatPassword} onChange={(e) => setForm({ ...form, repeatPassword: e.target.value })} /><Button>{labels[2]}</Button></form></Shell>;
}

function Panel() {
  const auth = useAuth();
  const navigate = useNavigate();
  return <Shell title="Welcome to the User Panel"><p className="mb-4">You have successfully logged in.</p><p className="mb-4 rounded-lg bg-amber-950 p-3 text-amber-200">This is a demonstration environment. User accounts and associated demo data are cleared automatically by the production demo server every 24 hours. After the next reset, this account may no longer be available.</p><div className="flex gap-3"><Link className="text-cyan-300" to="/change-password">Change Password</Link><button className="text-cyan-300" onClick={async () => { await request('/api/auth/logout', { method: 'POST', csrfToken: auth.state.csrfToken }); auth.setState((prev) => mergeAuthSession(prev, { accessToken: '', csrfToken: '', user: null })); broadcastLogout(); navigate('/login', { replace: true }); }}>Logout</button></div></Shell>;
}

function ChangePassword() {
  const auth = useAuth();
  const navigate = useNavigate();
  const navItems = getChangePasswordNavigationItems();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', repeatNewPassword: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = isChangePasswordFormValid(form);
  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setMsg('');
    try {
      let accessToken = auth.state.accessToken;
      if (!accessToken) {
        const refreshed = await refreshSessionRequest();
        accessToken = refreshed.accessToken || '';
      }
      const send = async (token) => request('/api/user/change-password', { method: 'POST', body: form, csrfToken: auth.state.csrfToken, headers: { Authorization: `Bearer ${token}` } });
      let data;
      try {
        data = await send(accessToken);
      } catch (err) {
        if (err.message !== 'Unauthorized') throw err;
        const refreshed = await refreshSessionRequest();
        data = await send(refreshed.accessToken || '');
      }
      setMsg(data.status === 'ok' ? 'Password changed successfully.' : 'Unable to change password.');
      if (data.status === 'ok') setForm({ currentPassword: '', newPassword: '', repeatNewPassword: '' });
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };
  return <Shell title="Change Password"><Message text={msg} /><div className="mb-4 flex flex-wrap gap-3"><Link className="text-cyan-300" to={navItems[0].href}>{navItems[0].label}</Link><button className="text-cyan-300" onClick={async () => { await request('/api/auth/logout', { method: 'POST', csrfToken: auth.state.csrfToken }); auth.setState((prev) => mergeAuthSession(prev, { accessToken: '', csrfToken: '', user: null })); navigate('/login', { replace: true }); }}>{navItems[1].label}</button></div><form onSubmit={submit} className="space-y-4"><Input label="Current Password" type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /><Input label="New Password" type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /><Input label="Repeat New Password" type="password" value={form.repeatNewPassword} onChange={(e) => setForm({ ...form, repeatNewPassword: e.target.value })} /><Button disabled={!valid || busy}>{busy ? 'Updating...' : 'Update Password'}</Button></form></Shell>;
}

function AdminLogin() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const target = getAdminLoginRedirect(auth.state);
  if (target) return <Navigate to={target} replace />;
  return <Shell title="Admin Login"><Message text={msg} error /><form onSubmit={async (e) => { e.preventDefault(); try { const data = await request('/api/auth/admin-login', { method: 'POST', body: { username, password } }); auth.setState((prev) => mergeAuthSession(prev, data)); broadcastSessionState(data); navigate('/admin/dashboard', { replace: true }); } catch (err) { setMsg(err.message); } }} className="space-y-4"><Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} /><Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><Button>Login as Admin</Button></form></Shell>;
}

function AdminDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  useEffect(() => { request('/api/admin/users', { headers: { Authorization: `Bearer ${auth.state.accessToken}` } }).then((d) => setUsers(d.users || [])).catch(() => setUsers([])); }, [auth.state.accessToken]);
  const controls = getAdminDashboardControls();
  return <Shell title="Read-Only Admin Dashboard"><div className="mb-4 flex flex-wrap gap-3"><button className="text-cyan-300" onClick={async () => { await request('/api/auth/logout', { method: 'POST', csrfToken: auth.state.csrfToken }); clearAdminSession(auth, mergeAuthSession); broadcastLogout(); navigate('/admin/login', { replace: true }); }}>{controls[0].label}</button></div><p className="mb-3 text-amber-300">Demo Mode — Administrative modification is disabled in the public portfolio environment.</p><p className="mb-4 text-sm text-slate-400">For demonstration privacy, personal information is intentionally hidden from administrators.</p><div className="space-y-3">{users.map((u) => <div key={u.id} className="rounded-lg border border-slate-800 p-3 text-sm"><div>Email: {u.email}</div><div>First Name: ******</div><div>Last Name: ******</div><div>Phone: **********</div><div>Gender: ******</div><div>Address: ****************</div><div>Password: Not accessible — securely hashed.</div><div className="mt-2 flex gap-2"><button disabled className="rounded bg-slate-700 px-2 py-1">Block</button><button disabled className="rounded bg-slate-700 px-2 py-1">Remove</button><button disabled className="rounded bg-slate-700 px-2 py-1">Restore</button><button disabled className="rounded bg-slate-700 px-2 py-1">Permanently Delete</button></div></div>)}</div></Shell>;
}

createRoot(document.getElementById('root')).render(<App />);
