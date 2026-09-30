import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, BookOpen, LockKeyhole, MailCheck, ShieldCheck } from 'lucide-react'

export default function LoginScreen({ client }: { client: SupabaseClient }) {
  const recoveryError = new URLSearchParams(window.location.hash.slice(1)).get('error_code')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(recoveryError === 'otp_expired' ? 'That reset link expired or was already used. Request a new one below.' : '')
  const [mode, setMode] = useState<'sign-in' | 'reset'>('sign-in')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) setError('We could not sign you in with those details.')
    setLoading(false)
  }

  async function sendResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (resetError) {
      const message = resetError.message.toLowerCase()
      if (message.includes('redirect') || message.includes('url')) {
        setError('Supabase rejected the return address. In Authentication → URL Configuration, add http://localhost:5173/** to Redirect URLs, save, then try again.')
      } else if (message.includes('rate limit') || message.includes('too many')) {
        setError('Supabase is limiting password emails. Wait a few minutes, then request one new link.')
      } else {
        setError(`Supabase could not send the reset email: ${resetError.message}`)
      }
    } else setNotice('If an account exists for that email, a password reset link is on its way. Open the newest email promptly.')
    setLoading(false)
  }

  return <main className="login-screen">
    <section className="login-visual">
      <div className="login-brand"><span className="brand-mark"><BookOpen size={19} /></span><b>church<span>records</span></b></div>
      <div className="login-message"><span>CARE STARTS WITH KNOWING</span><h1>Every name holds<br />a story worth keeping.</h1><p>A calm, private place to care for the people who make your church a community.</p></div>
      <div className="login-visual-footer"><ShieldCheck size={15} /> Your church's information stays private.</div>
    </section>
    <section className="login-form-side"><form className="login-form" onSubmit={mode === 'sign-in' ? signIn : sendResetLink}>
      <div className="login-lock">{mode === 'sign-in' ? <LockKeyhole size={19} /> : <MailCheck size={19} />}</div><div className="login-eyebrow">CHURCH ADMINISTRATION</div><h2>{mode === 'sign-in' ? 'Welcome back' : 'Reset your password'}</h2><p>{mode === 'sign-in' ? 'Sign in with the account invited to your church workspace.' : 'We’ll email a secure link to set a new password for your account.'}</p>
      <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@yourchurch.org" /></label>
      {mode === 'sign-in' && <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></label>}
      {error && <div className="login-error" role="alert">{error}</div>}
      {notice && <div className="login-notice" role="status">{notice}</div>}
      <button className="button button-primary login-submit" disabled={loading}>{loading ? 'Please wait...' : mode === 'sign-in' ? 'Sign in securely' : 'Send reset link'}</button>
      {mode === 'sign-in' ? <button type="button" className="auth-text-button forgot-password" onClick={() => { setMode('reset'); setError(''); setNotice('') }}>Forgot password?</button> : <button type="button" className="auth-text-button back-to-signin" onClick={() => { setMode('sign-in'); setError(''); setNotice('') }}><ArrowLeft size={13} /> Back to sign in</button>}
      <div className="login-assurance"><ShieldCheck size={14} /> Access is limited to invited church staff.</div>
    </form></section>
  </main>
}