import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowRight, BookOpen, LockKeyhole, ShieldCheck } from 'lucide-react'

export default function PasswordRecoveryScreen({ client, onContinue }: { client: SupabaseClient; onContinue: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [complete, setComplete] = useState(false)

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    setSaving(true)
    setError('')
    const { error: updateError } = await client.auth.updateUser({ password })
    if (updateError) setError('We could not update your password. Request a fresh reset email and try again.')
    else setComplete(true)
    setSaving(false)
  }

  return <main className="password-recovery-screen">
    <div className="login-brand"><span className="brand-mark"><BookOpen size={19} /></span><b>church<span>records</span></b></div>
    <section className="password-recovery-card">
      <div className="login-lock"><LockKeyhole size={19} /></div>
      <div className="login-eyebrow">ACCOUNT SECURITY</div>
      <h1>{complete ? 'Password updated' : 'Set a new password'}</h1>
      <p>{complete ? 'Your account password is now changed. Continue to your church workspace.' : 'Choose a new password for your Church Records account.'}</p>
      {complete ? <button className="button button-primary recovery-continue" onClick={onContinue}>Continue to Church Records <ArrowRight size={15} /></button> : <form className="login-form recovery-form" onSubmit={updatePassword}>
        <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" /></label>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="button button-primary login-submit" disabled={saving}>{saving ? 'Updating password...' : 'Update password'}</button>
      </form>}
      <div className="login-assurance"><ShieldCheck size={14} /> Your account is protected.</div>
    </section>
  </main>
}
