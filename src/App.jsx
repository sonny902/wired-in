import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const COLORS = [
  '#00d4ff', '#ff6b35', '#4ade80', '#f59e0b',
  '#f87171', '#a78bfa', '#fb7185', '#34d399',
  '#e879f9', '#fbbf24'
]

const DEFAULT_MODES = [
  { name: 'BUSINESS', color: '#00d4ff', tasks: [] },
  { name: 'REVISION', color: '#ff6b35', tasks: [] }
]

const fmt = d => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function getTaskTimes(tasks, now) {
  let cur = now
  return tasks.map(t => {
    const start = cur
    const end = cur + t.duration * 60000
    if (!t.done) cur = end
    return { start, end }
  })
}

const CSS = `
  @keyframes rise {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes flipOut {
    from { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
    to   { opacity: 0; transform: scale(0.95) translateY(-8px); filter: blur(6px); }
  }
  @keyframes flipIn {
    from { opacity: 0; transform: scale(1.04) translateY(8px); filter: blur(6px); }
    to   { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: var(--pulse-shadow); }
    50%       { opacity: 0.5; box-shadow: none; }
  }
  @keyframes checkPop {
    0%   { transform: scale(0.8); }
    60%  { transform: scale(1.25); }
    100% { transform: scale(1); }
  }
  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .rise { animation: rise 0.5s cubic-bezier(.16,1,.3,1) both; }
  .flip-out { animation: flipOut 0.32s cubic-bezier(.4,0,1,1) both; }
  .flip-in  { animation: flipIn 0.38s cubic-bezier(0,0,.2,1) both; }
  .slide-up { animation: slideUp 0.3s cubic-bezier(.16,1,.3,1) both; }
  .pulse-dot { animation: pulse 2.2s ease-in-out infinite; }
  .check-pop { animation: checkPop 0.3s cubic-bezier(.16,1,.3,1); }
  .spin { animation: spin 0.8s linear infinite; }
  ::-webkit-scrollbar { display: none; }
  button { cursor: pointer; font-family: inherit; }
  input, textarea { font-family: inherit; outline: none; }
  input::placeholder { color: #252525; }
`

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendLink = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 28px', background: '#070707'
    }}>
      <div style={{ marginBottom: 52, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 58, letterSpacing: 8, color: '#fff', lineHeight: 1, textShadow: '0 0 60px #00d4ff30' }}>WIRED IN</div>
        <div style={{ fontSize: 9, color: '#2a2a2a', letterSpacing: 5, marginTop: 8 }}>ZERO GAP FOCUS</div>
      </div>

      {sent ? (
        <div className="rise" style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📬</div>
          <div style={{ fontSize: 13, color: '#fff', marginBottom: 8 }}>Check your email</div>
          <div style={{ fontSize: 11, color: '#444', lineHeight: 1.8 }}>
            We sent a magic link to<br />
            <span style={{ color: '#00d4ff' }}>{email}</span><br />
            Tap it to sign in — no password needed.
          </div>
        </div>
      ) : (
        <div className="rise" style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ fontSize: 9, color: '#333', letterSpacing: 4, marginBottom: 24 }}>SIGN IN / CREATE ACCOUNT</div>
          <input
            type="email" autoFocus value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendLink()}
            placeholder="your@email.com"
            style={{
              width: '100%', background: '#0f0f0f', border: '1px solid #1e1e1e',
              borderRadius: 14, padding: '17px', color: '#fff', fontSize: 14, marginBottom: 12
            }}
            onFocus={e => e.target.style.borderColor = '#00d4ff'}
            onBlur={e => e.target.style.borderColor = '#1e1e1e'}
          />
          {error && <div style={{ fontSize: 11, color: '#f87171', marginBottom: 12, letterSpacing: 1 }}>{error}</div>}
          <button onClick={sendLink} style={{
            width: '100%', border: 'none', borderRadius: 16, padding: '20px',
            background: email.trim() ? '#00d4ff' : '#111',
            color: email.trim() ? '#000' : '#333',
            fontSize: 12, fontWeight: 700, letterSpacing: 4,
            boxShadow: email.trim() ? '0 10px 40px #00d4ff40' : 'none',
            transition: 'all 0.25s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
          }}>
            {loading
              ? <div className="spin" style={{ width: 16, height: 16, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%' }} />
              : 'SEND MAGIC LINK →'}
          </button>
          <div style={{ fontSize: 9, color: '#252525', letterSpacing: 2, textAlign: 'center', marginTop: 20 }}>NO PASSWORD. NO BS. JUST AN EMAIL.</div>
        </div>
      )}
    </div>
  )
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function Setup({ onComplete }) {
  const [step, setStep] = useState(0)
  const [cfg, setCfg] = useState({ 0: { name: '', color: '#00d4ff' }, 1: { name: '', color: '#ff6b35' } })

  const modeIdx = step < 2 ? 0 : 1
  const isName = step % 2 === 0
  const current = cfg[modeIdx]
  const canAdvance = isName ? current.name.trim().length > 0 : true

  const advance = () => {
    if (!canAdvance) return
    if (step === 3) onComplete([
      { name: cfg[0].name || 'MODE A', color: cfg[0].color, tasks: [] },
      { name: cfg[1].name || 'MODE B', color: cfg[1].color, tasks: [] }
    ])
    else setStep(s => s + 1)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', background: '#070707' }}>
      <div style={{ marginBottom: 52, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 58, letterSpacing: 8, color: '#fff', lineHeight: 1, textShadow: `0 0 60px ${current.color}40` }}>WIRED IN</div>
        <div style={{ fontSize: 9, color: '#2a2a2a', letterSpacing: 5, marginTop: 8 }}>ZERO GAP FOCUS</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 48 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ height: 3, width: i < step ? 28 : i === step ? 20 : 8, borderRadius: 2, background: i <= step ? current.color : '#1a1a1a', transition: 'all 0.35s' }} />
        ))}
      </div>
      <div key={step} className="rise" style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ fontSize: 9, color: '#333', letterSpacing: 4, marginBottom: 24 }}>MODE {modeIdx + 1} OF 2 — {isName ? 'WHAT IS IT?' : 'PICK A COLOUR'}</div>
        {isName ? (
          <input autoFocus value={current.name}
            onChange={e => setCfg(p => ({ ...p, [modeIdx]: { ...p[modeIdx], name: e.target.value.toUpperCase().slice(0, 12) } }))}
            onKeyDown={e => e.key === 'Enter' && advance()}
            placeholder={modeIdx === 0 ? 'e.g. BUSINESS' : 'e.g. REVISION'}
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `2px solid ${current.color}`, color: '#fff', fontSize: 38, fontFamily: "'Bebas Neue'", letterSpacing: 5, padding: '8px 0', marginBottom: 40 }}
          />
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setCfg(p => ({ ...p, [modeIdx]: { ...p[modeIdx], color: c } }))}
                style={{ width: 48, height: 48, borderRadius: 14, background: c, cursor: 'pointer', border: current.color === c ? '3px solid #fff' : '3px solid transparent', transform: current.color === c ? 'scale(1.2)' : 'scale(1)', boxShadow: current.color === c ? `0 0 24px ${c}60` : 'none', transition: 'all 0.18s' }} />
            ))}
          </div>
        )}
        <button onClick={advance} style={{ width: '100%', border: 'none', borderRadius: 16, padding: '20px', background: canAdvance ? current.color : '#111', color: canAdvance ? '#000' : '#333', fontSize: 12, fontWeight: 700, letterSpacing: 4, boxShadow: canAdvance ? `0 10px 40px ${current.color}50` : 'none', transition: 'all 0.25s' }}>
          {step === 3 ? 'GET WIRED IN →' : 'NEXT →'}
        </button>
      </div>
    </div>
  )
}

// ─── Task Item ────────────────────────────────────────────────────────────────

function TaskItem({ task, times, isCurrent, color, onToggle, onDelete }) {
  const [popped, setPopped] = useState(false)
  const handleToggle = () => { setPopped(true); setTimeout(() => setPopped(false), 300); onToggle(task.id) }

  return (
    <div style={{ background: task.done ? '#0a0a0a' : isCurrent ? `${color}0d` : '#0d0d0d', border: `1px solid ${task.done ? '#111' : isCurrent ? `${color}30` : '#161616'}`, borderRadius: 16, padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 13, transition: 'all 0.35s', animation: 'rise 0.4s both' }}>
      <div onClick={handleToggle} className={popped ? 'check-pop' : ''} style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, border: `2px solid ${task.done ? color : '#252525'}`, background: task.done ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.22s', boxShadow: task.done ? `0 0 16px ${color}50` : 'none' }}>
        {task.done && <span style={{ fontSize: 13, color: '#000', fontWeight: 800 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: task.done ? '#252525' : isCurrent ? '#fff' : '#555', fontWeight: isCurrent ? 500 : 400, textDecoration: task.done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.3s' }}>{task.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <div style={{ fontSize: 9, color: '#252525', letterSpacing: 1 }}>{task.done ? 'DONE' : `${fmt(times.start)} → ${fmt(times.end)}`} · {task.duration}m</div>
          {isCurrent && !task.done && (
            <div style={{ flex: 1, height: 2, background: '#1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, ((Date.now() - times.start) / (task.duration * 60000)) * 100)}%`, background: color, borderRadius: 1, transition: 'width 30s linear' }} />
            </div>
          )}
        </div>
      </div>
      {isCurrent && !task.done && <div className="pulse-dot" style={{ '--pulse-shadow': `0 0 12px ${color}`, width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', color: '#1e1e1e', fontSize: 20, padding: '0 2px', flexShrink: 0, transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#555'} onMouseLeave={e => e.target.style.color = '#1e1e1e'}>×</button>
    </div>
  )
}

// ─── Add Sheet ────────────────────────────────────────────────────────────────

function AddSheet({ color, modeName, onAdd, onClose }) {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(45)
  const submit = () => { if (!title.trim()) return; onAdd({ id: Date.now(), title: title.trim(), duration, done: false }); onClose() }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'flex-end' }}>
      <div className="slide-up" style={{ width: '100%', background: '#0e0e0e', border: '1px solid #1a1a1a', borderTop: `2px solid ${color}`, borderRadius: '24px 24px 0 0', padding: '30px 24px 52px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: color, letterSpacing: 4 }}>ADD TO {modeName}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#333', fontSize: 24 }}>×</button>
        </div>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="What exactly are you doing?" style={{ width: '100%', background: '#161616', border: '1px solid #222', borderRadius: 14, padding: '17px', color: '#fff', fontSize: 14, marginBottom: 16 }} onFocus={e => e.target.style.borderColor = color} onBlur={e => e.target.style.borderColor = '#222'} />
        <div style={{ fontSize: 9, color: '#333', letterSpacing: 3, marginBottom: 12 }}>HOW LONG?</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[15, 30, 45, 60, 90].map(d => (
            <button key={d} onClick={() => setDuration(d)} style={{ flex: 1, border: 'none', borderRadius: 12, background: duration === d ? color : '#161616', color: duration === d ? '#000' : '#444', padding: '13px 0', fontSize: 11, fontWeight: 700, boxShadow: duration === d ? `0 4px 16px ${color}40` : 'none', transition: 'all 0.18s' }}>{d}m</button>
          ))}
        </div>
        <button onClick={submit} style={{ width: '100%', border: 'none', borderRadius: 16, padding: '20px', background: title.trim() ? color : '#161616', color: title.trim() ? '#000' : '#333', fontSize: 12, fontWeight: 700, letterSpacing: 4, boxShadow: title.trim() ? `0 8px 32px ${color}50` : 'none', transition: 'all 0.22s' }}>ADD TASK →</button>
      </div>
    </div>
  )
}

// ─── Settings Sheet ───────────────────────────────────────────────────────────

function SettingsSheet({ modes, onUpdateColor, onClearAll, onSignOut, onClose }) {
  const [confirmClear, setConfirmClear] = useState(false)

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'flex-end' }}>
      <div className="slide-up" style={{ width: '100%', background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: '24px 24px 0 0', padding: '30px 24px 52px', maxHeight: '85dvh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: 4 }}>SETTINGS</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#333', fontSize: 24 }}>×</button>
        </div>
        {modes.map((m, i) => (
          <div key={i} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, marginBottom: 14, color: m.color }}>{m.name} — COLOUR</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => onUpdateColor(i, c)} style={{ width: 44, height: 44, borderRadius: 13, background: c, cursor: 'pointer', border: m.color === c ? '3px solid #fff' : '3px solid transparent', transform: m.color === c ? 'scale(1.22)' : 'scale(1)', boxShadow: m.color === c ? `0 0 20px ${c}60` : 'none', transition: 'all 0.18s' }} />
              ))}
            </div>
          </div>
        ))}
        <div style={{ height: 1, background: '#161616', margin: '8px 0 24px' }} />
        <button onClick={() => { if (confirmClear) { onClearAll(); setConfirmClear(false); onClose() } else setConfirmClear(true) }} style={{ width: '100%', border: '1px solid #1e1e1e', borderRadius: 14, padding: '16px', background: confirmClear ? '#1a0a0a' : 'transparent', color: confirmClear ? '#f87171' : '#444', fontSize: 11, letterSpacing: 2, marginBottom: 10, transition: 'all 0.2s' }}>
          {confirmClear ? 'TAP AGAIN TO CONFIRM' : 'CLEAR ALL TASKS'}
        </button>
        <button onClick={onSignOut} style={{ width: '100%', border: '1px solid #1e1e1e', borderRadius: 14, padding: '16px', background: 'transparent', color: '#333', fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>SIGN OUT</button>
        <button onClick={onClose} style={{ width: '100%', background: '#161616', border: 'none', borderRadius: 14, padding: '16px', color: '#666', fontSize: 11, letterSpacing: 2 }}>DONE</button>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isSetup, setIsSetup] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [modes, setModes] = useState(DEFAULT_MODES)
  const [active, setActive] = useState(0)
  const [flipping, setFlipping] = useState(false)
  const [flipPhase, setFlipPhase] = useState('in')
  const [contentKey, setContentKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase.from('wiredin_data').select('modes, active_mode').eq('user_id', session.user.id).single()
      .then(({ data, error }) => {
        if (error || !data) setIsSetup(true)
        else { setModes(data.modes); setActive(data.active_mode); setIsSetup(false) }
      })
  }, [session])

  const sync = useCallback(async (m, a) => {
    if (!session) return
    setSyncing(true)
    await supabase.from('wiredin_data').upsert({ user_id: session.user.id, modes: m, active_mode: a, updated_at: new Date().toISOString() })
    setSyncing(false)
  }, [session])

  useEffect(() => {
    if (!session || isSetup) return
    const t = setTimeout(() => sync(modes, active), 800)
    return () => clearTimeout(t)
  }, [modes, active, session, isSetup, sync])

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])

  const flip = useCallback(() => {
    if (flipping) return
    setFlipping(true); setFlipPhase('out')
    setTimeout(() => { setActive(p => p === 0 ? 1 : 0); setContentKey(p => p + 1); setFlipPhase('in'); setTimeout(() => setFlipping(false), 380) }, 320)
  }, [flipping])

  const addTask = t => setModes(p => p.map((m, i) => i === active ? { ...m, tasks: [...m.tasks, t] } : m))
  const toggleTask = id => setModes(p => p.map((m, i) => i === active ? { ...m, tasks: m.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) } : m))
  const deleteTask = id => setModes(p => p.map((m, i) => i === active ? { ...m, tasks: m.tasks.filter(t => t.id !== id) } : m))
  const updateColor = (mi, c) => setModes(p => p.map((m, i) => i === mi ? { ...m, color: c } : m))
  const clearAll = () => setModes(p => p.map(m => ({ ...m, tasks: [] })))
  const signOut = () => supabase.auth.signOut()

  const completeSetup = async newModes => {
    setModes(newModes); setIsSetup(false)
    await supabase.from('wiredin_data').upsert({ user_id: session.user.id, modes: newModes, active_mode: 0, updated_at: new Date().toISOString() })
  }

  if (authLoading) return (
    <div style={{ minHeight: '100dvh', background: '#070707', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{CSS}</style>
      <div className="spin" style={{ width: 24, height: 24, border: '2px solid #1a1a1a', borderTopColor: '#00d4ff', borderRadius: '50%' }} />
    </div>
  )

  if (!session) return <><style>{CSS}</style><AuthScreen /></>
  if (isSetup) return <><style>{CSS}</style><Setup onComplete={completeSetup} /></>

  const mode = modes[active]
  const other = modes[active === 0 ? 1 : 0]
  const pending = mode.tasks.filter(t => !t.done)
  const done = mode.tasks.filter(t => t.done)
  const doneByTs = now + pending.reduce((a, t) => a + t.duration, 0) * 60000
  const taskTimes = getTaskTimes(mode.tasks, now)

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: '100dvh', background: '#070707', position: 'relative', overflowX: 'hidden' }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 100% 50% at 50% -10%, ${mode.color}20 0%, transparent 65%)`, transition: 'background 0.7s ease' }} />
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '30%', pointerEvents: 'none', background: `radial-gradient(ellipse 80% 100% at 50% 100%, ${mode.color}08 0%, transparent 70%)`, transition: 'background 0.7s ease' }} />

        {syncing && (
          <div style={{ position: 'fixed', top: 14, right: 16, zIndex: 300, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="spin" style={{ width: 10, height: 10, border: '1.5px solid #1a1a1a', borderTopColor: mode.color, borderRadius: '50%' }} />
            <span style={{ fontSize: 8, color: '#333', letterSpacing: 2 }}>SYNCING</span>
          </div>
        )}

        <div key={contentKey} className={flipPhase === 'out' ? 'flip-out' : 'flip-in'} style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '58px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 9, color: '#252525', letterSpacing: 5, marginBottom: 10 }}>YOU ARE WIRED IN TO</div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 66, letterSpacing: 4, color: mode.color, lineHeight: 1, textShadow: `0 0 50px ${mode.color}35`, transition: 'color 0.5s, text-shadow 0.5s' }}>{mode.name}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, alignItems: 'flex-end' }}>
              <button onClick={flip} style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', borderRadius: 12, padding: '10px 16px', color: '#444', fontSize: 9, letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = other.color} onMouseLeave={e => e.currentTarget.style.borderColor = '#1c1c1c'}>
                <span style={{ fontSize: 14 }}>⇄</span><span style={{ color: other.color }}>{other.name}</span>
              </button>
              <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', color: '#252525', fontSize: 22, letterSpacing: 3, padding: '0 2px' }}>···</button>
            </div>
          </div>

          <div style={{ padding: '24px 24px 0', display: 'flex' }}>
            {[
              { label: 'REMAINING', value: pending.length, color: '#fff' },
              { label: 'DONE BY', value: pending.length > 0 ? fmt(doneByTs) : '—', color: mode.color },
              { label: 'COMPLETE', value: done.length, color: mode.color }
            ].map((s, i) => (
              <div key={i} style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: '#252525', letterSpacing: 3 }}>{s.label}</div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: s.color, transition: 'color 0.4s', lineHeight: 1.2 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ margin: '22px 24px 0' }}>
            <div style={{ height: 1, background: '#111', borderRadius: 1, overflow: 'hidden' }}>
              {mode.tasks.length > 0 && <div style={{ height: '100%', width: `${(done.length / mode.tasks.length) * 100}%`, background: mode.color, borderRadius: 1, boxShadow: `0 0 8px ${mode.color}`, transition: 'width 0.5s' }} />}
            </div>
          </div>

          <div style={{ padding: '16px 24px 150px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
            {mode.tasks.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
                <div style={{ fontSize: 32, opacity: 0.15 }}>⚡</div>
                <div style={{ fontSize: 9, color: '#1c1c1c', letterSpacing: 4, textAlign: 'center', lineHeight: 2 }}>NO TASKS YET<br /><span style={{ fontSize: 8 }}>ADD YOUR FIRST ONE BELOW</span></div>
              </div>
            ) : mode.tasks.map((task, idx) => {
              const isCurrent = !task.done && mode.tasks.slice(0, idx).every(t => t.done)
              return <TaskItem key={task.id} task={task} times={taskTimes[idx]} isCurrent={isCurrent} color={mode.color} onToggle={toggleTask} onDelete={deleteTask} />
            })}
          </div>
        </div>

        <div style={{ position: 'fixed', bottom: 32, left: 24, right: 24, zIndex: 100 }}>
          <button onClick={() => setShowAdd(true)} style={{ width: '100%', border: 'none', borderRadius: 18, padding: '21px', background: mode.color, color: '#000', fontSize: 12, fontWeight: 800, letterSpacing: 5, boxShadow: `0 10px 48px ${mode.color}55, 0 0 0 1px ${mode.color}20`, transition: 'all 0.3s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 16px 56px ${mode.color}65` }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 10px 48px ${mode.color}55` }}>+ ADD TASK</button>
        </div>

        {showAdd && <AddSheet color={mode.color} modeName={mode.name} onAdd={addTask} onClose={() => setShowAdd(false)} />}
        {showSettings && <SettingsSheet modes={modes} onUpdateColor={updateColor} onClearAll={clearAll} onSignOut={signOut} onClose={() => setShowSettings(false)} />}
      </div>
    </>
  )
}
