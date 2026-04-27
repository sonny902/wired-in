import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ── Constants ─────────────────────────────────────────────────────────────────
const COLORS = ['#00d4ff','#ff6b35','#4ade80','#f59e0b','#f87171','#a78bfa','#fb7185','#34d399','#e879f9','#fbbf24']
const PRI = {
  high:   { val:3, color:'#f87171', bg:'rgba(248,113,113,.1)', label:'HIGH' },
  medium: { val:2, color:'#f59e0b', bg:'rgba(245,158,11,.1)',  label:'MED'  },
  low:    { val:1, color:'#74d99f', bg:'rgba(74,222,128,.1)',  label:'LOW'  }
}
const QW_MINS   = 10
const DAY_START = '07:00'
const DAY_END   = '22:00'

// ── Utils ─────────────────────────────────────────────────────────────────────
const pad    = n => String(n).padStart(2,'0')
const t2m    = t => { const [h,m]=t.split(':').map(Number); return h*60+m }
const nowM   = () => { const d=new Date(); return d.getHours()*60+d.getMinutes() }
const fmtT   = m => { const h=Math.floor(m/60); const mn=m%60; return `${h%12||12}:${pad(mn)}${h>=12?'pm':'am'}` }
const uid    = () => Math.random().toString(36).slice(2,8)
const dayLbl = () => new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})
const clockStr = () => { const d=new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

// ── Gap-filling algorithm ─────────────────────────────────────────────────────
function buildTimeline(mode) {
  const { fixedBlocks=[], tasks=[], quickWins=[] } = mode
  const dayS = t2m(DAY_START), dayE = t2m(DAY_END)
  const cur  = Math.max(nowM(), dayS)

  const sorted = [...fixedBlocks].sort((a,b)=>t2m(a.startTime)-t2m(b.startTime))

  // Build gaps across whole day
  const gaps = []
  let ptr = dayS
  for (const b of sorted) {
    const bs=t2m(b.startTime), be=bs+b.duration
    if (bs>ptr) gaps.push({start:ptr,end:bs})
    ptr = Math.max(ptr,be)
  }
  if (ptr<dayE) gaps.push({start:ptr,end:dayE})

  // Sort pending tasks by priority desc
  const pendT = [...tasks].filter(t=>!t.done).sort((a,b)=>PRI[b.priority].val-PRI[a.priority].val)
  const pendQ = quickWins.filter(q=>!q.done)
  const usedT = new Set(), usedQ = new Set()
  const sched = []

  for (const gap of gaps) {
    const gs = Math.max(gap.start, cur)
    if (gs>=gap.end) continue
    let rem=gap.end-gs, c=gs

    for (const t of pendT) {
      if (usedT.has(t.id)||t.duration>rem) continue
      sched.push({type:'task',...t,start:c,end:c+t.duration})
      usedT.add(t.id); c+=t.duration; rem-=t.duration
    }
    for (const q of pendQ) {
      if (usedQ.has(q.id)||QW_MINS>rem) continue
      sched.push({type:'quickwin',...q,duration:QW_MINS,start:c,end:c+QW_MINS})
      usedQ.add(q.id); c+=QW_MINS; rem-=QW_MINS
    }
  }

  const fixedSched = sorted.map(b=>({type:'fixed',...b,start:t2m(b.startTime),end:t2m(b.startTime)+b.duration}))
  return [...fixedSched,...sched].sort((a,b)=>a.start-b.start)
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
  @keyframes rise    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes flipOut { from{opacity:1;transform:scale(1);filter:blur(0)} to{opacity:0;transform:scale(.95);filter:blur(8px)} }
  @keyframes flipIn  { from{opacity:0;transform:scale(1.04);filter:blur(8px)} to{opacity:1;transform:scale(1);filter:blur(0)} }
  @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes pop     { 0%{transform:scale(.75)} 60%{transform:scale(1.3)} 100%{transform:scale(1)} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes glow    { 0%,100%{opacity:.5} 50%{opacity:1} }
  @keyframes slideIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
  .rise    {animation:rise    .5s cubic-bezier(.16,1,.3,1) both}
  .flip-out{animation:flipOut .3s ease both}
  .flip-in {animation:flipIn  .38s ease both}
  .slide-up{animation:slideUp .3s cubic-bezier(.16,1,.3,1) both}
  .pop     {animation:pop     .28s cubic-bezier(.16,1,.3,1)}
  .spin    {animation:spin    .8s linear infinite}
  .pulse   {animation:pulse   2s ease-in-out infinite}
  .glow    {animation:glow    2.5s ease-in-out infinite}
  .slide-in{animation:slideIn .3s cubic-bezier(.16,1,.3,1) both}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  ::-webkit-scrollbar{display:none}
  button{cursor:pointer;font-family:inherit;border:none;background:none}
  input,select{font-family:inherit;outline:none}
  input::placeholder{color:#252525}
  body{overscroll-behavior:none;user-select:none}
`

// ── Helpers ───────────────────────────────────────────────────────────────────
const itemColor = (item, modeColor) =>
  item.type==='fixed' ? modeColor : item.type==='quickwin' ? '#a78bfa' : PRI[item.priority]?.color || modeColor

function Spinner({ color='#00d4ff', size=22 }) {
  return <div className="spin" style={{width:size,height:size,border:'2px solid #1a1a1a',borderTopColor:color,borderRadius:'50%'}} />
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen() {
  const [email,setEmail]=useState('')
  const [sent,setSent]=useState(false)
  const [loading,setLoading]=useState(false)
  const [err,setErr]=useState('')

  const send = async () => {
    if (!email.trim()) return
    setLoading(true); setErr('')
    const {error} = await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin}})
    setLoading(false)
    if (error){setErr(error.message);return}
    setSent(true)
  }

  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',background:'#070707'}}>
      <div style={{marginBottom:52,textAlign:'center'}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:60,letterSpacing:8,color:'#fff',lineHeight:1,textShadow:'0 0 80px #00d4ff20'}}>WIRED IN</div>
        <div style={{fontSize:9,color:'#1e1e1e',letterSpacing:5,marginTop:8}}>ZERO GAP FOCUS</div>
      </div>
      {sent ? (
        <div className="rise" style={{textAlign:'center',maxWidth:280}}>
          <div style={{fontSize:44,marginBottom:20}}>📬</div>
          <div style={{fontSize:14,color:'#fff',marginBottom:10}}>Check your inbox</div>
          <div style={{fontSize:11,color:'#444',lineHeight:2}}>Magic link sent to<br/><span style={{color:'#00d4ff'}}>{email}</span><br/>Tap it to sign in.</div>
        </div>
      ) : (
        <div className="rise" style={{width:'100%',maxWidth:340}}>
          <div style={{fontSize:9,color:'#2a2a2a',letterSpacing:4,marginBottom:20}}>SIGN IN OR CREATE ACCOUNT</div>
          <input type="email" autoFocus value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="your@email.com"
            style={{width:'100%',background:'#0d0d0d',border:'1px solid #1e1e1e',borderRadius:14,padding:'17px',color:'#fff',fontSize:14,marginBottom:10,transition:'border-color .2s'}}
            onFocus={e=>e.target.style.borderColor='#00d4ff'} onBlur={e=>e.target.style.borderColor='#1e1e1e'} />
          {err&&<div style={{fontSize:11,color:'#f87171',marginBottom:10,letterSpacing:1}}>{err}</div>}
          <button onClick={send} style={{width:'100%',borderRadius:16,padding:'20px',background:email.trim()?'#00d4ff':'#111',color:email.trim()?'#000':'#333',fontSize:12,fontWeight:700,letterSpacing:4,boxShadow:email.trim()?'0 10px 40px #00d4ff40':'none',transition:'all .25s',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            {loading?<Spinner color="#000" size={16}/>:'SEND MAGIC LINK →'}
          </button>
          <div style={{fontSize:9,color:'#1a1a1a',letterSpacing:2,textAlign:'center',marginTop:20}}>NO PASSWORD. NO BS.</div>
        </div>
      )}
    </div>
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function Setup({ onComplete }) {
  const [step,setStep]=useState(0)
  const [cfg,setCfg]=useState({0:{name:'',color:'#00d4ff'},1:{name:'',color:'#ff6b35'}})
  const mi=step<2?0:1, isName=step%2===0, cur=cfg[mi], ok=isName?cur.name.trim().length>0:true

  const next = () => {
    if (!ok) return
    if (step===3) onComplete([
      {name:cfg[0].name||'MODE A',color:cfg[0].color,fixedBlocks:[],tasks:[],quickWins:[]},
      {name:cfg[1].name||'MODE B',color:cfg[1].color,fixedBlocks:[],tasks:[],quickWins:[]}
    ])
    else setStep(s=>s+1)
  }

  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',background:'#070707'}}>
      <div style={{marginBottom:52,textAlign:'center'}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:60,letterSpacing:8,color:'#fff',lineHeight:1,textShadow:`0 0 80px ${cur.color}25`}}>WIRED IN</div>
        <div style={{fontSize:9,color:'#1e1e1e',letterSpacing:5,marginTop:8}}>ZERO GAP FOCUS</div>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:48}}>
        {[0,1,2,3].map(i=><div key={i} style={{height:3,width:i<step?28:i===step?20:8,borderRadius:2,background:i<=step?cur.color:'#1a1a1a',transition:'all .35s'}}/>)}
      </div>
      <div key={step} className="rise" style={{width:'100%',maxWidth:340}}>
        <div style={{fontSize:9,color:'#2a2a2a',letterSpacing:4,marginBottom:24}}>MODE {mi+1} OF 2 — {isName?'NAME IT':'PICK A COLOUR'}</div>
        {isName ? (
          <input autoFocus value={cur.name}
            onChange={e=>setCfg(p=>({...p,[mi]:{...p[mi],name:e.target.value.toUpperCase().slice(0,12)}}))}
            onKeyDown={e=>e.key==='Enter'&&next()}
            placeholder={mi===0?'e.g. BUSINESS':'e.g. REVISION'}
            style={{width:'100%',background:'transparent',border:'none',borderBottom:`2px solid ${cur.color}`,color:'#fff',fontSize:40,fontFamily:"'Bebas Neue'",letterSpacing:5,padding:'8px 0',marginBottom:40}}/>
        ) : (
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:40}}>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>setCfg(p=>({...p,[mi]:{...p[mi],color:c}}))}
                style={{width:48,height:48,borderRadius:14,background:c,cursor:'pointer',border:cur.color===c?'3px solid #fff':'3px solid transparent',transform:cur.color===c?'scale(1.2)':'scale(1)',boxShadow:cur.color===c?`0 0 24px ${c}60`:'none',transition:'all .18s'}}/>
            ))}
          </div>
        )}
        <button onClick={next} style={{width:'100%',borderRadius:16,padding:'20px',background:ok?cur.color:'#111',color:ok?'#000':'#333',fontSize:12,fontWeight:700,letterSpacing:4,boxShadow:ok?`0 10px 40px ${cur.color}50`:'none',transition:'all .25s'}}>
          {step===3?'GET WIRED IN →':'NEXT →'}
        </button>
      </div>
    </div>
  )
}

// ── Current Task Hero ─────────────────────────────────────────────────────────
function CurrentHero({ item, modeColor }) {
  const [tick,setTick]=useState(0)
  useEffect(()=>{ const t=setInterval(()=>setTick(p=>p+1),30000); return()=>clearInterval(t) },[])

  const cur=nowM()
  const minsLeft = Math.max(0, item.end-cur)
  const pct = Math.min(100, ((cur-item.start)/item.duration)*100)
  const c = itemColor(item, modeColor)

  return (
    <div style={{margin:'18px 20px 0',background:`linear-gradient(145deg,${c}12 0%,transparent 55%)`,border:`1px solid ${c}28`,borderRadius:22,padding:'24px 22px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-50,right:-50,width:140,height:140,background:`radial-gradient(circle,${c}1a,transparent 70%)`,pointerEvents:'none'}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:8,color:'#2a2a2a',letterSpacing:4}}>RIGHT NOW</div>
        <div style={{fontSize:8,letterSpacing:2,color:c,background:`${c}1a`,padding:'4px 10px',borderRadius:20}}>
          {item.type==='fixed'?'FIXED':item.type==='quickwin'?'QUICK WIN':PRI[item.priority]?.label}
        </div>
      </div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:50,color:'#fff',lineHeight:1.02,letterSpacing:.5,marginBottom:16}}>{item.title}</div>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
        <div style={{fontSize:10,color:'#444',letterSpacing:.5}}>{fmtT(item.start)} → {fmtT(item.end)}</div>
        <div style={{fontSize:11,color:minsLeft<=5?'#f87171':c,fontWeight:500,letterSpacing:.5}}>
          {minsLeft===0?'ending now':`${minsLeft}m left`}
        </div>
      </div>
      <div style={{height:3,background:'rgba(255,255,255,.05)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:c,borderRadius:2,boxShadow:`0 0 10px ${c}`,transition:'width 30s linear'}}/>
      </div>
    </div>
  )
}

// ── Idle State ────────────────────────────────────────────────────────────────
function IdleHero({ next, color }) {
  if (!next) return (
    <div style={{margin:'18px 20px 0',background:'#0c0c0c',border:'1px solid #141414',borderRadius:22,padding:'40px 22px',textAlign:'center'}}>
      <div style={{fontSize:36,marginBottom:14,opacity:.1}}>🌙</div>
      <div style={{fontSize:9,color:'#1e1e1e',letterSpacing:4}}>NOTHING SCHEDULED</div>
    </div>
  )
  const mins = Math.max(0, next.start - nowM())
  const c = itemColor(next, color)
  return (
    <div style={{margin:'18px 20px 0',background:'#0c0c0c',border:'1px solid #141414',borderRadius:22,padding:'24px 22px'}}>
      <div style={{fontSize:8,color:'#1e1e1e',letterSpacing:4,marginBottom:12}}>FREE TIME</div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:'#2a2a2a',letterSpacing:1,marginBottom:8}}>
        {mins>0?`${next.title} IN ${mins}m`:'STARTING NOW'}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:6,height:6,borderRadius:'50%',background:c}} className="pulse"/>
        <div style={{fontSize:11,color:'#444'}}>{fmtT(next.start)} — {next.title}</div>
      </div>
    </div>
  )
}

// ── Up Next Row ───────────────────────────────────────────────────────────────
function UpNextRow({ item, color, delay=0 }) {
  const c = itemColor(item, color)
  return (
    <div className="slide-in" style={{display:'flex',alignItems:'center',gap:14,padding:'13px 0',borderBottom:'1px solid #0e0e0e',animationDelay:`${delay}ms`}}>
      <div style={{width:3,height:38,borderRadius:2,background:c,flexShrink:0,boxShadow:`0 0 8px ${c}60`}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:'#777',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.title}</div>
        <div style={{fontSize:9,color:'#252525',marginTop:4,letterSpacing:.5}}>{fmtT(item.start)} · {item.duration}m</div>
      </div>
      <div style={{fontSize:8,letterSpacing:1.5,color:c,background:`${c}15`,padding:'4px 8px',borderRadius:6,flexShrink:0}}>
        {item.type==='fixed'?'FIXED':item.type==='quickwin'?'QUICK':PRI[item.priority]?.label}
      </div>
    </div>
  )
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({ mode, timeline, onFlip, other, onSettings }) {
  const [tick,setTick]=useState(0)
  useEffect(()=>{ const t=setInterval(()=>setTick(p=>p+1),30000); return()=>clearInterval(t) },[])

  const cur = nowM()
  const current  = timeline.find(b=>b.start<=cur&&b.end>cur)||null
  const upcoming = timeline.filter(b=>b.start>cur).slice(0,4)

  const allItems  = [...(mode.tasks||[]),...(mode.quickWins||[])]
  const doneCnt   = allItems.filter(t=>t.done).length
  const totalCnt  = allItems.length
  const dayPct    = totalCnt>0?(doneCnt/totalCnt)*100:0
  const minsLeft  = timeline.filter(b=>b.start>cur).reduce((s,b)=>s+b.duration,0)

  return (
    <div style={{paddingBottom:110}}>
      {/* Header */}
      <div style={{padding:'58px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontSize:9,color:'#1e1e1e',letterSpacing:5,marginBottom:10}}>WIRED IN TO</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:58,color:mode.color,lineHeight:1,letterSpacing:3,textShadow:`0 0 50px ${mode.color}28`}}>{mode.name}</div>
          <div style={{fontSize:9,color:'#252525',letterSpacing:1.5,marginTop:8}}>{dayLbl()} · {clockStr()}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,paddingTop:8,alignItems:'flex-end'}}>
          <button onClick={onFlip} style={{background:'#0f0f0f',border:'1px solid #1c1c1c',borderRadius:12,padding:'10px 14px',color:'#444',fontSize:9,letterSpacing:2,display:'flex',alignItems:'center',gap:8,transition:'all .2s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=other.color} onMouseLeave={e=>e.currentTarget.style.borderColor='#1c1c1c'}>
            <span style={{fontSize:13}}>⇄</span><span style={{color:other.color}}>{other.name}</span>
          </button>
          <button onClick={onSettings} style={{color:'#252525',fontSize:22,letterSpacing:3,padding:'0 2px',transition:'color .2s'}}
            onMouseEnter={e=>e.target.style.color='#555'} onMouseLeave={e=>e.target.style.color='#252525'}>···</button>
        </div>
      </div>

      {/* Current / idle */}
      {current ? <CurrentHero item={current} modeColor={mode.color}/> : <IdleHero next={upcoming[0]} color={mode.color}/>}

      {/* Stats row */}
      <div style={{display:'flex',gap:0,margin:'20px 20px 0',background:'#0c0c0c',border:'1px solid #141414',borderRadius:16,overflow:'hidden'}}>
        {[
          {label:'DONE TODAY', val:`${doneCnt}/${totalCnt}`},
          {label:'MINS LEFT',  val:minsLeft>0?`${minsLeft}m`:'—'},
          {label:'FREE GAPS',  val: timeline.filter(b=>b.start>cur&&b.type!=='fixed').length}
        ].map((s,i)=>(
          <div key={i} style={{flex:1,padding:'14px 16px',borderRight:i<2?'1px solid #111':'none'}}>
            <div style={{fontSize:8,color:'#252525',letterSpacing:2.5,marginBottom:4}}>{s.label}</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:22,color:mode.color,letterSpacing:1}}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Up next */}
      {upcoming.length>0 && (
        <div style={{margin:'22px 20px 0'}}>
          <div style={{fontSize:9,color:'#1e1e1e',letterSpacing:4,marginBottom:6}}>UP NEXT</div>
          {upcoming.map((item,i)=><UpNextRow key={item.id+i} item={item} color={mode.color} delay={i*60}/>)}
        </div>
      )}

      {/* Day progress */}
      {totalCnt>0 && (
        <div style={{margin:'22px 20px 0',padding:'18px',background:'#0c0c0c',border:'1px solid #141414',borderRadius:16}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <div style={{fontSize:9,color:'#2a2a2a',letterSpacing:3}}>DAY PROGRESS</div>
            <div style={{fontSize:9,color:mode.color,letterSpacing:2}}>{Math.round(dayPct)}%</div>
          </div>
          <div style={{height:4,background:'#111',borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${dayPct}%`,background:mode.color,borderRadius:2,boxShadow:`0 0 10px ${mode.color}`,transition:'width .6s cubic-bezier(.16,1,.3,1)'}}/>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────
function TimelineTab({ timeline, modeColor, mode }) {
  const ref = useRef(null)
  const [tick,setTick]=useState(0)
  useEffect(()=>{ const t=setInterval(()=>setTick(p=>p+1),60000); return()=>clearInterval(t) },[])

  const dayS=t2m(DAY_START), dayE=t2m(DAY_END), total=dayE-dayS
  const PPM = 2.8 // px per minute
  const totalPx = total*PPM
  const cur = nowM()
  const nowPct = Math.max(0,Math.min(1,(cur-dayS)/total))

  useEffect(()=>{
    if (ref.current) ref.current.scrollTop = nowPct*totalPx - 160
  },[])

  const hours = Array.from({length:16},(_,i)=>i+7)

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',paddingBottom:80}}>
      <div style={{padding:'56px 20px 16px',flexShrink:0}}>
        <div style={{fontSize:9,color:'#1e1e1e',letterSpacing:4,marginBottom:4}}>TIMELINE</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:42,color:modeColor,letterSpacing:3}}>{mode.name}</div>
        <div style={{fontSize:9,color:'#252525',letterSpacing:1.5,marginTop:4}}>{dayLbl()}</div>
      </div>

      <div ref={ref} style={{flex:1,overflowY:'auto',padding:'0 20px 20px',position:'relative'}}>
        <div style={{position:'relative',height:totalPx,marginLeft:44}}>

          {/* Hour lines */}
          {hours.map(h=>{
            const top=(h*60-dayS)*PPM
            return (
              <div key={h} style={{position:'absolute',top,left:-44,right:0,display:'flex',alignItems:'center',gap:10,pointerEvents:'none'}}>
                <div style={{fontSize:9,color:'#2a2a2a',width:36,textAlign:'right',flexShrink:0,letterSpacing:.5}}>{h%12||12}{h>=12?'p':'a'}</div>
                <div style={{flex:1,height:1,background:'#0e0e0e'}}/>
              </div>
            )
          })}

          {/* Now line */}
          {cur>=dayS&&cur<=dayE&&(
            <div style={{position:'absolute',top:nowPct*totalPx,left:-44,right:0,display:'flex',alignItems:'center',gap:8,zIndex:10,pointerEvents:'none'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:'#f87171',flexShrink:0,marginLeft:30,boxShadow:'0 0 10px #f87171'}} className="glow"/>
              <div style={{flex:1,height:1,background:'#f87171',boxShadow:'0 0 6px #f87171',opacity:.7}}/>
            </div>
          )}

          {/* Blocks */}
          {timeline.map((item,i)=>{
            if (item.end<dayS||item.start>dayE) return null
            const top=(Math.max(item.start,dayS)-dayS)*PPM
            const h=Math.max((item.end-item.start)*PPM-2,22)
            const c=itemColor(item,modeColor)
            const isCur=item.start<=cur&&item.end>cur
            const isPast=item.end<=cur

            return (
              <div key={item.id+i} style={{
                position:'absolute',top,left:0,right:0,height:h,
                background:isPast?`${c}08`:isCur?`${c}1e`:`${c}0e`,
                border:`1px solid ${isPast?c+'12':isCur?c+'50':c+'22'}`,
                borderLeft:`3px solid ${isPast?c+'30':c}`,
                borderRadius:10,padding:'7px 10px',overflow:'hidden',
                transition:'all .3s',
                boxShadow:isCur?`0 4px 24px ${c}20`:'none',
                opacity:isPast?.5:1
              }}>
                <div style={{fontSize:11,color:isPast?'#2a2a2a':isCur?'#fff':'#555',fontWeight:isCur?500:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',letterSpacing:.2}}>{item.title}</div>
                {h>32&&<div style={{fontSize:8,color:'#333',marginTop:3,letterSpacing:.5}}>{fmtT(item.start)} → {fmtT(item.end)} · {item.duration}m</div>}
                {isCur&&<div style={{position:'absolute',top:0,right:8,bottom:0,display:'flex',alignItems:'center'}}><div style={{width:6,height:6,borderRadius:'50%',background:c}} className="pulse"/></div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Plan Tab ──────────────────────────────────────────────────────────────────
function PlanItem({ item, color, type, onDelete, onToggle }) {
  const [popped,setPopped]=useState(false)
  const c = itemColor({...item,type}, color)

  const handleToggle = () => {
    setPopped(true); setTimeout(()=>setPopped(false),300); onToggle&&onToggle(item.id)
  }

  return (
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'13px 0',borderBottom:'1px solid #0d0d0d',animation:'rise .35s both'}}>
      {onToggle && (
        <div onClick={handleToggle} className={popped?'pop':''} style={{width:22,height:22,borderRadius:7,flexShrink:0,border:`2px solid ${item.done?c:'#1e1e1e'}`,background:item.done?c:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .2s',boxShadow:item.done?`0 0 14px ${c}50`:'none'}}>
          {item.done&&<span style={{fontSize:11,color:'#000',fontWeight:800}}>✓</span>}
        </div>
      )}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:item.done?'#252525':'#777',textDecoration:item.done?'line-through':'none',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.title}</div>
        <div style={{fontSize:9,color:'#252525',marginTop:4,letterSpacing:.5}}>
          {type==='fixed'?`${item.startTime} · ${item.duration}m`:type==='task'?`${item.duration}m · ${PRI[item.priority]?.label||''}`:` ~${QW_MINS}m`}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div style={{fontSize:8,color:c,background:`${c}15`,padding:'3px 8px',borderRadius:6,letterSpacing:1.5}}>
          {type==='fixed'?'FIXED':type==='quickwin'?'QUICK':PRI[item.priority]?.label}
        </div>
        <button onClick={()=>onDelete(item.id)} style={{color:'#1e1e1e',fontSize:18,padding:'0 2px',transition:'color .2s'}} onMouseEnter={e=>e.target.style.color='#555'} onMouseLeave={e=>e.target.style.color='#1e1e1e'}>×</button>
      </div>
    </div>
  )
}

function PlanSection({ title, accent, items, type, color, onAdd, onDelete, onToggle, empty }) {
  const [open,setOpen]=useState(true)
  return (
    <div style={{marginBottom:4}}>
      <div onClick={()=>setOpen(p=>!p)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',cursor:'pointer'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:3,height:14,borderRadius:2,background:accent}}/>
          <div style={{fontSize:9,color:'#555',letterSpacing:3.5}}>{title}</div>
          <div style={{fontSize:9,color:'#2a2a2a',background:'#111',padding:'2px 8px',borderRadius:20}}>{items.length}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={e=>{e.stopPropagation();onAdd()}} style={{background:accent,color:'#000',borderRadius:8,padding:'7px 14px',fontSize:9,fontWeight:700,letterSpacing:2,boxShadow:`0 4px 16px ${accent}40`}}>+ ADD</button>
          <div style={{color:'#2a2a2a',fontSize:12,transition:'transform .2s',transform:open?'rotate(0)':'rotate(-90deg)'}}>▾</div>
        </div>
      </div>
      {open&&(
        <div style={{padding:'0 20px',paddingBottom:items.length?8:0}}>
          {items.length===0?(
            <div style={{fontSize:9,color:'#161616',letterSpacing:3,padding:'16px 0',textAlign:'center'}}>{empty}</div>
          ):items.map(item=>(
            <PlanItem key={item.id} item={item} color={color} type={type} onDelete={onDelete} onToggle={onToggle}/>
          ))}
        </div>
      )}
      <div style={{height:1,background:'#0d0d0d',margin:'0 20px'}}/>
    </div>
  )
}

function PlanTab({ mode, onAddFixed, onAddTask, onAddQW, onDeleteFixed, onDeleteTask, onDeleteQW, onToggleTask, onToggleQW }) {
  return (
    <div style={{paddingBottom:110}}>
      <div style={{padding:'58px 20px 20px'}}>
        <div style={{fontSize:9,color:'#1e1e1e',letterSpacing:4,marginBottom:6}}>PLAN YOUR DAY</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:52,color:mode.color,letterSpacing:3}}>{mode.name}</div>
      </div>
      <PlanSection title="FIXED BLOCKS" accent={mode.color}       items={mode.fixedBlocks||[]} type="fixed"    color={mode.color} onAdd={onAddFixed} onDelete={onDeleteFixed} empty="NO FIXED BLOCKS — ADD A COMMITMENT"/>
      <PlanSection title="TASKS"        accent={PRI.high.color}   items={mode.tasks||[]}       type="task"     color={mode.color} onAdd={onAddTask}  onDelete={onDeleteTask}  onToggle={onToggleTask} empty="NO TASKS — ADD WHAT NEEDS DOING"/>
      <PlanSection title="QUICK WINS"   accent="#a78bfa"           items={mode.quickWins||[]}   type="quickwin" color={mode.color} onAdd={onAddQW}    onDelete={onDeleteQW}    onToggle={onToggleQW}   empty="NO QUICK WINS — ADD SHORT TASKS TO FILL GAPS"/>
    </div>
  )
}

// ── Sheets ────────────────────────────────────────────────────────────────────
function Sheet({ onClose, children }) {
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.82)',backdropFilter:'blur(22px)',display:'flex',alignItems:'flex-end'}}>
      <div className="slide-up" style={{width:'100%',background:'#0d0d0d',border:'1px solid #181818',borderRadius:'26px 26px 0 0',padding:'28px 24px 52px',maxHeight:'88dvh',overflowY:'auto'}}>
        {children}
      </div>
    </div>
  )
}

function SHdr({ title, color, onClose }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
      <div style={{fontSize:9,color,letterSpacing:4}}>{title}</div>
      <button onClick={onClose} style={{color:'#333',fontSize:26,lineHeight:1}}>×</button>
    </div>
  )
}

function TInput({ value, onChange, placeholder, onEnter, af, type='text' }) {
  return (
    <input type={type} autoFocus={af} value={value} onChange={e=>onChange(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onEnter&&onEnter()} placeholder={placeholder}
      style={{width:'100%',background:'#141414',border:'1px solid #1e1e1e',borderRadius:14,padding:'16px',color:'#fff',fontSize:14,marginBottom:14,transition:'border-color .2s'}}
      onFocus={e=>e.target.style.borderColor='#444'} onBlur={e=>e.target.style.borderColor='#1e1e1e'}/>
  )
}

function DurPicker({ val, onChange, color, opts=[15,30,45,60,90] }) {
  return (
    <div style={{display:'flex',gap:8,marginBottom:16}}>
      {opts.map(d=>(
        <button key={d} onClick={()=>onChange(d)} style={{flex:1,borderRadius:12,background:val===d?color:'#141414',color:val===d?'#000':'#444',padding:'13px 0',fontSize:11,fontWeight:700,boxShadow:val===d?`0 4px 16px ${color}40`:'none',transition:'all .18s'}}>{d}m</button>
      ))}
    </div>
  )
}

function SBtn({ onClick, label, color, disabled }) {
  return (
    <button onClick={onClick} style={{width:'100%',borderRadius:16,padding:'20px',background:disabled?'#141414':color,color:disabled?'#333':'#000',fontSize:12,fontWeight:700,letterSpacing:4,boxShadow:disabled?'none':`0 8px 32px ${color}50`,transition:'all .22s'}}>
      {label}
    </button>
  )
}

function AddFixedSheet({ color, modeName, onAdd, onClose }) {
  const [title,setTitle]=useState(''), [time,setTime]=useState('09:00'), [dur,setDur]=useState(30)
  const ok=title.trim()
  const submit=()=>{ if(!ok)return; onAdd({id:uid(),title:title.trim(),startTime:time,duration:dur}); onClose() }
  return (
    <Sheet onClose={onClose}>
      <SHdr title={`FIXED BLOCK · ${modeName}`} color={color} onClose={onClose}/>
      <TInput value={title} onChange={setTitle} placeholder="e.g. Team call, Gym" onEnter={submit} af/>
      <div style={{fontSize:9,color:'#2a2a2a',letterSpacing:3,marginBottom:10}}>START TIME</div>
      <input type="time" value={time} onChange={e=>setTime(e.target.value)}
        style={{width:'100%',background:'#141414',border:'1px solid #1e1e1e',borderRadius:14,padding:'16px',color:'#fff',fontSize:16,marginBottom:16,colorScheme:'dark'}}/>
      <div style={{fontSize:9,color:'#2a2a2a',letterSpacing:3,marginBottom:10}}>DURATION</div>
      <DurPicker val={dur} onChange={setDur} color={color}/>
      <SBtn onClick={submit} label="ADD FIXED BLOCK →" color={color} disabled={!ok}/>
    </Sheet>
  )
}

function AddTaskSheet({ color, modeName, onAdd, onClose }) {
  const [title,setTitle]=useState(''), [dur,setDur]=useState(45), [pri,setPri]=useState('high')
  const ok=title.trim()
  const submit=()=>{ if(!ok)return; onAdd({id:uid(),title:title.trim(),duration:dur,priority:pri,done:false}); onClose() }
  return (
    <Sheet onClose={onClose}>
      <SHdr title={`TASK · ${modeName}`} color={color} onClose={onClose}/>
      <TInput value={title} onChange={setTitle} placeholder="What needs doing?" onEnter={submit} af/>
      <div style={{fontSize:9,color:'#2a2a2a',letterSpacing:3,marginBottom:10}}>DURATION</div>
      <DurPicker val={dur} onChange={setDur} color={color}/>
      <div style={{fontSize:9,color:'#2a2a2a',letterSpacing:3,marginBottom:10}}>PRIORITY</div>
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {['high','medium','low'].map(p=>{
          const inf=PRI[p]
          return <button key={p} onClick={()=>setPri(p)} style={{flex:1,borderRadius:12,background:pri===p?inf.color:'#141414',color:pri===p?'#000':'#444',padding:'13px 0',fontSize:11,fontWeight:700,letterSpacing:1,boxShadow:pri===p?`0 4px 16px ${inf.color}40`:'none',transition:'all .18s'}}>{inf.label}</button>
        })}
      </div>
      <SBtn onClick={submit} label="ADD TASK →" color={color} disabled={!ok}/>
    </Sheet>
  )
}

function AddQWSheet({ color, onAdd, onClose }) {
  const [title,setTitle]=useState('')
  const ok=title.trim()
  const submit=()=>{ if(!ok)return; onAdd({id:uid(),title:title.trim(),done:false}); onClose() }
  return (
    <Sheet onClose={onClose}>
      <SHdr title="QUICK WIN" color="#a78bfa" onClose={onClose}/>
      <div style={{fontSize:11,color:'#333',marginBottom:18,lineHeight:1.8}}>A ~10 minute task. Wired In fills spare gaps in your day with these automatically.</div>
      <TInput value={title} onChange={setTitle} placeholder="e.g. Reply to emails" onEnter={submit} af/>
      <SBtn onClick={submit} label="ADD QUICK WIN →" color="#a78bfa" disabled={!ok}/>
    </Sheet>
  )
}

function SettingsSheet({ modes, onUpdateColor, onClearAll, onSignOut, onClose }) {
  const [cc,setCc]=useState(false)
  return (
    <Sheet onClose={onClose}>
      <SHdr title="SETTINGS" color="#444" onClose={onClose}/>
      {modes.map((m,i)=>(
        <div key={i} style={{marginBottom:28}}>
          <div style={{fontSize:9,letterSpacing:3,marginBottom:14,color:m.color}}>{m.name} — COLOUR</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>onUpdateColor(i,c)} style={{width:44,height:44,borderRadius:13,background:c,cursor:'pointer',border:m.color===c?'3px solid #fff':'3px solid transparent',transform:m.color===c?'scale(1.2)':'scale(1)',boxShadow:m.color===c?`0 0 20px ${c}60`:'none',transition:'all .18s'}}/>
            ))}
          </div>
        </div>
      ))}
      <div style={{height:1,background:'#141414',margin:'0 0 20px'}}/>
      <button onClick={()=>{if(cc){onClearAll();setCc(false);onClose()}else setCc(true)}}
        style={{width:'100%',border:'1px solid #1e1e1e',borderRadius:14,padding:'16px',background:cc?'#1a0a0a':'transparent',color:cc?'#f87171':'#444',fontSize:11,letterSpacing:2,marginBottom:10,transition:'all .2s'}}>
        {cc?'TAP AGAIN TO CONFIRM':'CLEAR ALL TASKS & BLOCKS'}
      </button>
      <button onClick={onSignOut} style={{width:'100%',border:'1px solid #1e1e1e',borderRadius:14,padding:'16px',background:'transparent',color:'#333',fontSize:11,letterSpacing:2,marginBottom:10}}>SIGN OUT</button>
      <button onClick={onClose} style={{width:'100%',background:'#141414',borderRadius:14,padding:'16px',color:'#666',fontSize:11,letterSpacing:2}}>DONE</button>
    </Sheet>
  )
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function Nav({ tab, setTab, color }) {
  const items = [
    {key:'home',     icon:'⚡', label:'TODAY'},
    {key:'timeline', icon:'▦',  label:'TIMELINE'},
    {key:'plan',     icon:'≡',  label:'PLAN'}
  ]
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'rgba(5,5,5,.96)',backdropFilter:'blur(24px)',borderTop:'1px solid #0f0f0f',padding:'10px 0 28px',display:'flex'}}>
      {items.map(it=>(
        <button key={it.key} onClick={()=>setTab(it.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5,padding:'8px 0'}}>
          <div style={{fontSize:17,opacity:tab===it.key?1:.2,transition:'opacity .2s'}}>{it.icon}</div>
          <div style={{fontSize:8,letterSpacing:2,color:tab===it.key?color:'#2a2a2a',transition:'color .2s'}}>{it.label}</div>
          {tab===it.key&&<div style={{width:16,height:2,borderRadius:1,background:color,marginTop:2,boxShadow:`0 0 6px ${color}`}}/>}
        </button>
      ))}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]=useState(null)
  const [authLoading,setAuthLoading]=useState(true)
  const [isSetup,setIsSetup]=useState(false)
  const [syncing,setSyncing]=useState(false)
  const [modes,setModes]=useState([
    {name:'BUSINESS',color:'#00d4ff',fixedBlocks:[],tasks:[],quickWins:[]},
    {name:'REVISION',color:'#ff6b35',fixedBlocks:[],tasks:[],quickWins:[]}
  ])
  const [active,setActive]=useState(0)
  const [tab,setTab]=useState('home')
  const [flipping,setFlipping]=useState(false)
  const [flipPhase,setFlipPhase]=useState('in')
  const [ck,setCk]=useState(0)
  const [settings,setSettings]=useState(false)
  const [sheet,setSheet]=useState(null) // 'fixed'|'task'|'qw'

  // Auth
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s))
    return()=>subscription.unsubscribe()
  },[])

  // Load
  useEffect(()=>{
    if(!session) return
    supabase.from('wiredin_data').select('modes,active_mode').eq('user_id',session.user.id).single()
      .then(({data,error})=>{ if(error||!data) setIsSetup(true); else{setModes(data.modes);setActive(data.active_mode);setIsSetup(false)} })
  },[session])

  // Sync
  const sync=useCallback(async(m,a)=>{
    if(!session) return
    setSyncing(true)
    await supabase.from('wiredin_data').upsert({user_id:session.user.id,modes:m,active_mode:a,updated_at:new Date().toISOString()})
    setSyncing(false)
  },[session])

  useEffect(()=>{
    if(!session||isSetup) return
    const t=setTimeout(()=>sync(modes,active),800)
    return()=>clearTimeout(t)
  },[modes,active,session,isSetup,sync])

  const flip=useCallback(()=>{
    if(flipping) return
    setFlipping(true); setFlipPhase('out')
    setTimeout(()=>{ setActive(p=>p===0?1:0); setCk(p=>p+1); setFlipPhase('in'); setTimeout(()=>setFlipping(false),380) },320)
  },[flipping])

  const upd=useCallback(fn=>setModes(p=>p.map((m,i)=>i===active?fn(m):m)),[active])

  const addFixed=b=>upd(m=>({...m,fixedBlocks:[...m.fixedBlocks,b]}))
  const delFixed=id=>upd(m=>({...m,fixedBlocks:m.fixedBlocks.filter(b=>b.id!==id)}))
  const addTask =t=>upd(m=>({...m,tasks:[...m.tasks,t]}))
  const delTask =id=>upd(m=>({...m,tasks:m.tasks.filter(t=>t.id!==id)}))
  const togTask =id=>upd(m=>({...m,tasks:m.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}))
  const addQW  =q=>upd(m=>({...m,quickWins:[...m.quickWins,q]}))
  const delQW  =id=>upd(m=>({...m,quickWins:m.quickWins.filter(q=>q.id!==id)}))
  const togQW  =id=>upd(m=>({...m,quickWins:m.quickWins.map(q=>q.id===id?{...q,done:!q.done}:q)}))
  const updColor=(mi,c)=>setModes(p=>p.map((m,i)=>i===mi?{...m,color:c}:m))
  const clearAll=()=>setModes(p=>p.map(m=>({...m,tasks:[],quickWins:[],fixedBlocks:[]})))
  const signOut=()=>supabase.auth.signOut()

  const completeSetup=async nm=>{
    setModes(nm); setIsSetup(false)
    await supabase.from('wiredin_data').upsert({user_id:session.user.id,modes:nm,active_mode:0,updated_at:new Date().toISOString()})
  }

  if (authLoading) return (
    <div style={{minHeight:'100dvh',background:'#070707',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <style>{CSS}</style><Spinner/>
    </div>
  )
  if (!session) return <><style>{CSS}</style><AuthScreen/></>
  if (isSetup)  return <><style>{CSS}</style><Setup onComplete={completeSetup}/></>

  const mode=modes[active], other=modes[active===0?1:0]
  const timeline=buildTimeline(mode)

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100dvh',background:'#070707',overflowX:'hidden'}}>

        {/* Ambient glow */}
        <div style={{position:'fixed',inset:0,pointerEvents:'none',background:`radial-gradient(ellipse 110% 45% at 50% 0%,${mode.color}15 0%,transparent 65%)`,transition:'background .8s ease'}}/>
        <div style={{position:'fixed',bottom:0,left:0,right:0,height:'25%',pointerEvents:'none',background:`radial-gradient(ellipse 90% 100% at 50% 100%,${mode.color}07 0%,transparent 70%)`,transition:'background .8s ease'}}/>

        {/* Sync */}
        {syncing&&(
          <div style={{position:'fixed',top:16,right:16,zIndex:300,display:'flex',alignItems:'center',gap:6}}>
            <div className="spin" style={{width:10,height:10,border:'1.5px solid #1a1a1a',borderTopColor:mode.color,borderRadius:'50%'}}/>
            <span style={{fontSize:8,color:'#252525',letterSpacing:2}}>SYNCING</span>
          </div>
        )}

        {/* Content */}
        <div key={ck} className={flipPhase==='out'?'flip-out':'flip-in'} style={{minHeight:'100dvh',overflowY:'auto'}}>
          {tab==='home'&&<HomeTab mode={mode} timeline={timeline} onFlip={flip} other={other} onSettings={()=>setSettings(true)}/>}
          {tab==='timeline'&&<TimelineTab timeline={timeline} modeColor={mode.color} mode={mode}/>}
          {tab==='plan'&&<PlanTab mode={mode}
            onAddFixed={()=>setSheet('fixed')} onAddTask={()=>setSheet('task')} onAddQW={()=>setSheet('qw')}
            onDeleteFixed={delFixed} onDeleteTask={delTask} onDeleteQW={delQW}
            onToggleTask={togTask} onToggleQW={togQW}/>}
        </div>

        <Nav tab={tab} setTab={setTab} color={mode.color}/>

        {sheet==='fixed'&&<AddFixedSheet color={mode.color} modeName={mode.name} onAdd={addFixed} onClose={()=>setSheet(null)}/>}
        {sheet==='task' &&<AddTaskSheet  color={mode.color} modeName={mode.name} onAdd={addTask}  onClose={()=>setSheet(null)}/>}
        {sheet==='qw'   &&<AddQWSheet    color={mode.color}                       onAdd={addQW}    onClose={()=>setSheet(null)}/>}
        {settings&&<SettingsSheet modes={modes} onUpdateColor={updColor} onClearAll={clearAll} onSignOut={signOut} onClose={()=>setSettings(false)}/>}
      </div>
    </>
  )
}
