import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BookOpen, LockKeyhole, ShieldCheck } from 'lucide-react'

export default function LoginScreen({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) setError('We could not sign you in with those details.')
    setLoading(false)
  }

  return <main className="login-screen">
    <section className="login-visual">
      <div className="login-brand"><span className="brand-mark"><BookOpen size={19} /></span><b>church<span>records</span></b></div>
      <div className="login-message"><span>CARE STARTS WITH KNOWING</span><h1>Every name holds<br />a story worth keeping.</h1><p>A calm, private place to care for the people who make your church a community.</p></div>
      <div className="login-visual-footer"><ShieldCheck size={15} /> Your church's information stays private.</div>
    </section>
    <section className="login-form-side"><form className="login-form" onSubmit={signIn}>
      <div className="login-lock"><LockKeyhole size={19} /></div><div className="login-eyebrow">CHURCH ADMINISTRATION</div><h2>Welcome back</h2><p>Sign in with the account invited to your church workspace.</p>
      <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@yourchurch.org" /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></label>
      {error && <div className="login-error" role="alert">{error}</div>}
      <button className="button button-primary login-submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in securely'}</button>
      <div className="login-assurance"><ShieldCheck size={14} /> Access is limited to invited church staff.</div>
    </form></section>
  </main>
}