import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ── Constants ─────────────────────────────────────────────────────────────────
const COLORS = ['#00d4ff','#ff6b35','#4ade80','#f59e0b','#f87171','#a78bfa','#fb7185','#34d399','#e879f9','#fbbf24']
const PRI = {
  high:   { val:3, color:'#f87171', bg:'rgba(248,113,113,.12)', label:'HIGH' },
  medium: { val:2, color:'#f59e0b', bg:'rgba(245,158,11,.12)',  label:'MED'  },
  low:    { val:1, color:'#4ade80', bg:'rgba(74,222,128,.12)',  label:'LOW'  }
}
const QW_MINS   = 10
const DAY_START = '07:00'
const DAY_END   = '22:00'

// ── Themes ────────────────────────────────────────────────────────────────────
const DARK = {
  bg:       '#070707',
  card:     '#111111',
  cardB:    '#0d0d0d',
  border:   '#1e1e1e',
  borderB:  '#151515',
  text:     '#ffffff',
  textB:    '#cccccc',
  textC:    '#999999',
  textD:    '#666666',
  textE:    '#444444',
  textF:    '#333333',
  input:    '#141414',
  sheet:    '#0e0e0e',
  nav:      'rgba(5,5,5,.97)',
  navBd:    '#111111',
  shadow:   'none',
  dark:      true
}
const LIGHT = {
  bg:       '#f0efe9',
  card:     '#ffffff',
  cardB:    '#f8f7f3',
  border:   '#e2e0d8',
  borderB:  '#ebebea',
  text:     '#111111',
  textB:    '#333333',
  textC:    '#555555',
  textD:    '#777777',
  textE:    '#999999',
  textF:    '#bbbbbb',
  input:    '#f0efe9',
  sheet:    '#ffffff',
  nav:      'rgba(240,239,233,.97)',
  navBd:    '#e2e0d8',
  shadow:   '0 2px 20px rgba(0,0,0,.07)',
  dark:      false
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const pad    = n => String(n).padStart(2,'0')
const t2m    = t => { const [h,m]=t.split(':').map(Number); return h*60+m }
const nowM   = () => { const d=new Date(); return d.getHours()*60+d.getMinutes() }
const fmtT   = m => { const h=Math.floor(m/60); const mn=m%60; return `${h%12||12}:${pad(mn)}${h>=12?'pm':'am'}` }
const uid    = () => Math.random().toString(36).slice(2,8)
const dayLbl = () => new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})
const clockStr = () => { const d=new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const iColor = (item, mc) => item.type==='fixed'?mc:item.type==='quickwin'?'#a78bfa':PRI[item.priority]?.color||mc

// ── Gap Filling ───────────────────────────────────────────────────────────────
function buildTimeline(mode) {
  const { fixedBlocks=[], tasks=[], quickWins=[] } = mode
  const dayS=t2m(DAY_START), dayE=t2m(DAY_END), cur=Math.max(nowM(),dayS)
  const sorted=[...fixedBlocks].sort((a,b)=>t2m(a.startTime)-t2m(b.startTime))
  const gaps=[], usedT=new Set(), usedQ=new Set(), sched=[]
  let ptr=dayS
  for (const b of sorted) {
    const bs=t2m(b.startTime),be=bs+b.duration
    if (bs>ptr) gaps.push({start:ptr,end:bs})
    ptr=Math.max(ptr,be)
  }
  if (ptr<dayE) gaps.push({start:ptr,end:dayE})
  const pendT=[...tasks].filter(t=>!t.done).sort((a,b)=>PRI[b.priority].val-PRI[a.priority].val)
  const pendQ=quickWins.filter(q=>!q.done)
  for (const gap of gaps) {
    const gs=Math.max(gap.start,cur); if(gs>=gap.end) continue
    let rem=gap.end-gs,c=gs
    for (const t of pendT) { if(usedT.has(t.id)||t.duration>rem) continue; sched.push({type:'task',...t,start:c,end:c+t.duration}); usedT.add(t.id); c+=t.duration; rem-=t.duration }
    for (const q of pendQ) { if(usedQ.has(q.id)||QW_MINS>rem) continue; sched.push({type:'quickwin',...q,duration:QW_MINS,start:c,end:c+QW_MINS}); usedQ.add(q.id); c+=QW_MINS; rem-=QW_MINS }
  }
  const fixedSched=sorted.map(b=>({type:'fixed',...b,start:t2m(b.startTime),end:t2m(b.startTime)+b.duration}))
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
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes slideR  { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
  .rise    {animation:rise    .5s cubic-bezier(.16,1,.3,1) both}
  .flip-out{animation:flipOut .3s ease both}
  .flip-in {animation:flipIn  .38s ease both}
  .slide-up{animation:slideUp .3s cubic-bezier(.16,1,.3,1) both}
  .pop     {animation:pop     .28s cubic-bezier(.16,1,.3,1)}
  .spin    {animation:spin    .8s linear infinite}
  .pulse   {animation:pulse   2s ease-in-out infinite}
  .glow    {animation:glow    2.5s ease-in-out infinite}
  .fade-in {animation:fadeIn  .3s ease both}
  .slide-r {animation:slideR  .35s cubic-bezier(.16,1,.3,1) both}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  ::-webkit-scrollbar{display:none}
  button{cursor:pointer;font-family:inherit;border:none;background:none}
  input,select{font-family:inherit;outline:none}
  body{overscroll-behavior:none;user-select:none;font-family:'DM Mono',monospace}
`

// ── Helpers ───────────────────────────────────────────────────────────────────
function Spinner({ color='#00d4ff', size=22 }) {
  return <div className="spin" style={{width:size,height:size,border:`2px solid rgba(128,128,128,.2)`,borderTopColor:color,borderRadius:'50%'}}/>
}

function Chip({ type, priority, modeColor }) {
  const c = iColor({type,priority}, modeColor)
  const label = type==='fixed'?'FIXED':type==='quickwin'?'QUICK':PRI[priority]?.label||''
  return <span style={{fontSize:8,letterSpacing:1.5,color:c,background:`${c}18`,padding:'4px 9px',borderRadius:20,flexShrink:0}}>{label}</span>
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function AuthScreen() {
  const [email,setEmail]=useState(''), [password,setPassword]=useState('')
  const [isSignUp,setIsSignUp]=useState(false), [loading,setLoading]=useState(false)
  const [err,setErr]=useState(''), [success,setSuccess]=useState('')

  const submit = async () => {
    if (!email.trim()||!password.trim()) return
    setLoading(true); setErr(''); setSuccess('')
    if (isSignUp) {
      const {error}=await supabase.auth.signUp({email:email.trim(),password})
      setLoading(false)
      if (error){setErr(error.message);return}
      setSuccess('Account created — signing you in...')
      // auto sign in after signup
      await supabase.auth.signInWithPassword({email:email.trim(),password})
    } else {
      const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
      setLoading(false)
      if (error){setErr(error.message);return}
    }
  }

  const inputStyle = {width:'100%',background:'#0d0d0d',border:'1px solid #222',borderRadius:14,padding:'17px',color:'#fff',fontSize:14,marginBottom:10,transition:'border-color .2s'}

  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',background:'#070707'}}>
      <div style={{marginBottom:52,textAlign:'center'}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:60,letterSpacing:8,color:'#fff',lineHeight:1,textShadow:'0 0 80px #00d4ff18'}}>WIRED IN</div>
        <div style={{fontSize:9,color:'#333',letterSpacing:5,marginTop:8}}>ZERO GAP FOCUS</div>
      </div>

      <div className="rise" style={{width:'100%',maxWidth:340}}>
        <div style={{fontSize:9,color:'#444',letterSpacing:4,marginBottom:20}}>{isSignUp?'CREATE ACCOUNT':'SIGN IN'}</div>

        <input type="email" autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
          style={inputStyle} onFocus={e=>e.target.style.borderColor='#00d4ff'} onBlur={e=>e.target.style.borderColor='#222'}/>

        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="password"
          style={inputStyle} onFocus={e=>e.target.style.borderColor='#00d4ff'} onBlur={e=>e.target.style.borderColor='#222'}/>

        {err&&<div style={{fontSize:11,color:'#f87171',marginBottom:10,lineHeight:1.6}}>{err}</div>}
        {success&&<div style={{fontSize:11,color:'#4ade80',marginBottom:10}}>{success}</div>}

        <button onClick={submit} style={{width:'100%',borderRadius:16,padding:'20px',background:email.trim()&&password.trim()?'#00d4ff':'#111',color:email.trim()&&password.trim()?'#000':'#444',fontSize:12,fontWeight:700,letterSpacing:4,boxShadow:email.trim()&&password.trim()?'0 10px 40px #00d4ff40':'none',transition:'all .25s',display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:16}}>
          {loading?<Spinner color="#000" size={16}/>:isSignUp?'CREATE ACCOUNT →':'SIGN IN →'}
        </button>

        <button onClick={()=>{setIsSignUp(p=>!p);setErr('');setSuccess('')}} style={{width:'100%',background:'transparent',color:'#444',fontSize:11,letterSpacing:2,padding:'8px',textAlign:'center',transition:'color .2s'}}
          onMouseEnter={e=>e.target.style.color='#888'} onMouseLeave={e=>e.target.style.color='#444'}>
          {isSignUp?'ALREADY HAVE AN ACCOUNT? SIGN IN':'NEW HERE? CREATE ACCOUNT'}
        </button>
      </div>
    </div>
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function Setup({ onComplete }) {
  const [step,setStep]=useState(0), [cfg,setCfg]=useState({0:{name:'',color:'#00d4ff'},1:{name:'',color:'#ff6b35'}})
  const mi=step<2?0:1, isName=step%2===0, cur=cfg[mi], ok=isName?cur.name.trim().length>0:true
  const next=()=>{
    if(!ok) return
    if(step===3) onComplete([
      {name:cfg[0].name||'MODE A',color:cfg[0].color,fixedBlocks:[],tasks:[],quickWins:[]},
      {name:cfg[1].name||'MODE B',color:cfg[1].color,fixedBlocks:[],tasks:[],quickWins:[]}
    ]); else setStep(s=>s+1)
  }
  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',background:'#070707'}}>
      <div style={{marginBottom:52,textAlign:'center'}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:60,letterSpacing:8,color:'#fff',lineHeight:1,textShadow:`0 0 80px ${cur.color}25`}}>WIRED IN</div>
        <div style={{fontSize:9,color:'#333',letterSpacing:5,marginTop:8}}>ZERO GAP FOCUS</div>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:48}}>{[0,1,2,3].map(i=><div key={i} style={{height:3,width:i<step?28:i===step?20:8,borderRadius:2,background:i<=step?cur.color:'#222',transition:'all .35s'}}/>)}</div>
      <div key={step} className="rise" style={{width:'100%',maxWidth:340}}>
        <div style={{fontSize:9,color:'#444',letterSpacing:4,marginBottom:24}}>MODE {mi+1} OF 2 — {isName?'NAME IT':'PICK A COLOUR'}</div>
        {isName?(
          <input autoFocus value={cur.name} onChange={e=>setCfg(p=>({...p,[mi]:{...p[mi],name:e.target.value.toUpperCase().slice(0,12)}}))} onKeyDown={e=>e.key==='Enter'&&next()} placeholder={mi===0?'e.g. BUSINESS':'e.g. REVISION'}
            style={{width:'100%',background:'transparent',border:'none',borderBottom:`2px solid ${cur.color}`,color:'#fff',fontSize:40,fontFamily:"'Bebas Neue'",letterSpacing:5,padding:'8px 0',marginBottom:40}}/>
        ):(
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:40}}>
            {COLORS.map(c=><div key={c} onClick={()=>setCfg(p=>({...p,[mi]:{...p[mi],color:c}}))} style={{width:48,height:48,borderRadius:14,background:c,cursor:'pointer',border:cur.color===c?'3px solid #fff':'3px solid transparent',transform:cur.color===c?'scale(1.2)':'scale(1)',boxShadow:cur.color===c?`0 0 24px ${c}60`:'none',transition:'all .18s'}}/>)}
          </div>
        )}
        <button onClick={next} style={{width:'100%',borderRadius:16,padding:'20px',background:ok?cur.color:'#111',color:ok?'#000':'#444',fontSize:12,fontWeight:700,letterSpacing:4,boxShadow:ok?`0 10px 40px ${cur.color}50`:'none',transition:'all .25s'}}>
          {step===3?'GET WIRED IN →':'NEXT →'}
        </button>
      </div>
    </div>
  )
}

// ── Current Task Hero ─────────────────────────────────────────────────────────
function CurrentHero({ item, modeColor, th }) {
  const [,setT]=useState(0)
  useEffect(()=>{const t=setInterval(()=>setT(p=>p+1),30000);return()=>clearInterval(t)},[])
  const cur=nowM(), minsLeft=Math.max(0,item.end-cur), pct=Math.min(100,((cur-item.start)/item.duration)*100)
  const c=iColor(item,modeColor)
  return (
    <div style={{margin:'18px 20px 0',background:th.dark?`linear-gradient(145deg,${c}12 0%,transparent 55%)`:`linear-gradient(145deg,${c}0e 0%,transparent 55%)`,border:`1px solid ${c}28`,borderRadius:22,padding:'24px 22px',position:'relative',overflow:'hidden',boxShadow:th.shadow}}>
      <div style={{position:'absolute',top:-50,right:-50,width:140,height:140,background:`radial-gradient(circle,${c}15,transparent 70%)`,pointerEvents:'none'}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:8,color:th.textD,letterSpacing:4}}>RIGHT NOW</div>
        <Chip type={item.type} priority={item.priority} modeColor={modeColor}/>
      </div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:50,color:th.text,lineHeight:1.02,letterSpacing:.5,marginBottom:16}}>{item.title}</div>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
        <div style={{fontSize:10,color:th.textC,letterSpacing:.5}}>{fmtT(item.start)} → {fmtT(item.end)}</div>
        <div style={{fontSize:11,color:minsLeft<=5?'#f87171':c,fontWeight:500}}>{minsLeft===0?'ending now':`${minsLeft}m left`}</div>
      </div>
      <div style={{height:3,background:th.dark?'rgba(255,255,255,.06)':'rgba(0,0,0,.08)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:c,borderRadius:2,boxShadow:`0 0 10px ${c}`,transition:'width 30s linear'}}/>
      </div>
    </div>
  )
}

function IdleHero({ next, color, th }) {
  if (!next) return (
    <div style={{margin:'18px 20px 0',background:th.card,border:`1px solid ${th.border}`,borderRadius:22,padding:'40px 22px',textAlign:'center',boxShadow:th.shadow}}>
      <div style={{fontSize:36,marginBottom:14,opacity:.15}}>🌙</div>
      <div style={{fontSize:9,color:th.textF,letterSpacing:4}}>NOTHING SCHEDULED</div>
    </div>
  )
  const mins=Math.max(0,next.start-nowM()), c=iColor(next,color)
  return (
    <div style={{margin:'18px 20px 0',background:th.card,border:`1px solid ${th.border}`,borderRadius:22,padding:'24px 22px',boxShadow:th.shadow}}>
      <div style={{fontSize:8,color:th.textE,letterSpacing:4,marginBottom:12}}>FREE TIME</div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:th.textD,letterSpacing:1,marginBottom:8}}>{mins>0?`${next.title} IN ${mins}m`:'STARTING NOW'}</div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:6,height:6,borderRadius:'50%',background:c}} className="pulse"/>
        <div style={{fontSize:11,color:th.textC}}>{fmtT(next.start)} — {next.title}</div>
      </div>
    </div>
  )
}

function UpNextRow({ item, color, th, delay=0 }) {
  const c=iColor(item,color)
  return (
    <div className="slide-r" style={{display:'flex',alignItems:'center',gap:14,padding:'13px 0',borderBottom:`1px solid ${th.borderB}`,animationDelay:`${delay}ms`}}>
      <div style={{width:3,height:38,borderRadius:2,background:c,flexShrink:0,boxShadow:`0 0 8px ${c}50`}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:th.textB,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.title}</div>
        <div style={{fontSize:9,color:th.textD,marginTop:4}}>{fmtT(item.start)} · {item.duration}m</div>
      </div>
      <Chip type={item.type} priority={item.priority} modeColor={color}/>
    </div>
  )
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({ mode, timeline, onFlip, other, onSettings, th, darkMode, onToggleDark }) {
  const [,setT]=useState(0)
  useEffect(()=>{const t=setInterval(()=>setT(p=>p+1),30000);return()=>clearInterval(t)},[])
  const cur=nowM()
  const current=timeline.find(b=>b.start<=cur&&b.end>cur)||null
  const upcoming=timeline.filter(b=>b.start>cur).slice(0,4)
  const allItems=[...(mode.tasks||[]),...(mode.quickWins||[])]
  const doneCnt=allItems.filter(t=>t.done).length, totalCnt=allItems.length
  const dayPct=totalCnt>0?(doneCnt/totalCnt)*100:0
  const minsLeft=timeline.filter(b=>b.start>cur).reduce((s,b)=>s+b.duration,0)

  return (
    <div style={{paddingBottom:110}}>
      <div style={{padding:'58px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontSize:9,color:th.textE,letterSpacing:5,marginBottom:10}}>WIRED IN TO</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:58,color:mode.color,lineHeight:1,letterSpacing:3,textShadow:th.dark?`0 0 50px ${mode.color}28`:'none'}}>{mode.name}</div>
          <div style={{fontSize:9,color:th.textD,letterSpacing:1.5,marginTop:8}}>{dayLbl()} · {clockStr()}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,paddingTop:8,alignItems:'flex-end'}}>
          <button onClick={onFlip} style={{background:th.card,border:`1px solid ${th.border}`,borderRadius:12,padding:'10px 14px',color:th.textC,fontSize:9,letterSpacing:2,display:'flex',alignItems:'center',gap:8,transition:'all .2s',boxShadow:th.shadow}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=other.color} onMouseLeave={e=>e.currentTarget.style.borderColor=th.border}>
            <span style={{fontSize:13}}>⇄</span><span style={{color:other.color}}>{other.name}</span>
          </button>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={onToggleDark} style={{color:th.textD,fontSize:16,padding:'2px 4px',transition:'all .2s'}} title="Toggle theme">
              {darkMode?'☀️':'🌙'}
            </button>
            <button onClick={onSettings} style={{color:th.textD,fontSize:22,letterSpacing:3,padding:'0 2px',transition:'color .2s'}}
              onMouseEnter={e=>e.target.style.color=th.textB} onMouseLeave={e=>e.target.style.color=th.textD}>···</button>
          </div>
        </div>
      </div>

      {current?<CurrentHero item={current} modeColor={mode.color} th={th}/>:<IdleHero next={upcoming[0]} color={mode.color} th={th}/>}

      <div style={{display:'flex',margin:'20px 20px 0',background:th.card,border:`1px solid ${th.border}`,borderRadius:16,overflow:'hidden',boxShadow:th.shadow}}>
        {[{label:'DONE TODAY',val:`${doneCnt}/${totalCnt}`},{label:'MINS LEFT',val:minsLeft>0?`${minsLeft}m`:'—'},{label:'GAPS FILLED',val:timeline.filter(b=>b.start>cur&&b.type!=='fixed').length}].map((s,i)=>(
          <div key={i} style={{flex:1,padding:'14px 16px',borderRight:i<2?`1px solid ${th.borderB}`:'none'}}>
            <div style={{fontSize:8,color:th.textE,letterSpacing:2.5,marginBottom:4}}>{s.label}</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:22,color:mode.color,letterSpacing:1}}>{s.val}</div>
          </div>
        ))}
      </div>

      {upcoming.length>0&&(
        <div style={{margin:'22px 20px 0'}}>
          <div style={{fontSize:9,color:th.textE,letterSpacing:4,marginBottom:6}}>UP NEXT</div>
          {upcoming.map((item,i)=><UpNextRow key={item.id+i} item={item} color={mode.color} th={th} delay={i*60}/>)}
        </div>
      )}

      {totalCnt>0&&(
        <div style={{margin:'22px 20px 0',padding:'18px',background:th.card,border:`1px solid ${th.border}`,borderRadius:16,boxShadow:th.shadow}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <div style={{fontSize:9,color:th.textE,letterSpacing:3}}>TODAY'S PROGRESS</div>
            <div style={{fontSize:9,color:mode.color,letterSpacing:2}}>{Math.round(dayPct)}%</div>
          </div>
          <div style={{height:4,background:th.dark?'#111':'rgba(0,0,0,.08)',borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${dayPct}%`,background:mode.color,borderRadius:2,boxShadow:th.dark?`0 0 10px ${mode.color}`:'none',transition:'width .6s cubic-bezier(.16,1,.3,1)'}}/>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────
function TimelineTab({ timeline, modeColor, mode, th }) {
  const ref=useRef(null)
  const [,setT]=useState(0)
  useEffect(()=>{const t=setInterval(()=>setT(p=>p+1),60000);return()=>clearInterval(t)},[])
  const dayS=t2m(DAY_START), dayE=t2m(DAY_END), total=dayE-dayS
  const PPM=2.8, totalPx=total*PPM, cur=nowM()
  const nowPct=Math.max(0,Math.min(1,(cur-dayS)/total))
  useEffect(()=>{if(ref.current)ref.current.scrollTop=nowPct*totalPx-160},[])
  const hours=Array.from({length:16},(_,i)=>i+7)

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',paddingBottom:80}}>
      <div style={{padding:'56px 20px 16px',flexShrink:0}}>
        <div style={{fontSize:9,color:th.textE,letterSpacing:4,marginBottom:4}}>TIMELINE</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:42,color:modeColor,letterSpacing:3}}>{mode.name}</div>
        <div style={{fontSize:9,color:th.textD,letterSpacing:1.5,marginTop:4}}>{dayLbl()}</div>
      </div>
      <div ref={ref} style={{flex:1,overflowY:'auto',padding:'0 20px 20px',position:'relative'}}>
        <div style={{position:'relative',height:totalPx,marginLeft:44}}>
          {hours.map(h=>{
            const top=(h*60-dayS)*PPM
            return (
              <div key={h} style={{position:'absolute',top,left:-44,right:0,display:'flex',alignItems:'center',gap:10,pointerEvents:'none'}}>
                <div style={{fontSize:9,color:th.textD,width:36,textAlign:'right',flexShrink:0}}>{h%12||12}{h>=12?'p':'a'}</div>
                <div style={{flex:1,height:1,background:th.borderB}}/>
              </div>
            )
          })}
          {cur>=dayS&&cur<=dayE&&(
            <div style={{position:'absolute',top:nowPct*totalPx,left:-44,right:0,display:'flex',alignItems:'center',gap:8,zIndex:10,pointerEvents:'none'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:'#f87171',flexShrink:0,marginLeft:30,boxShadow:'0 0 10px #f87171'}} className="glow"/>
              <div style={{flex:1,height:1,background:'#f87171',opacity:.7}}/>
            </div>
          )}
          {timeline.map((item,i)=>{
            if(item.end<dayS||item.start>dayE) return null
            const top=(Math.max(item.start,dayS)-dayS)*PPM, h=Math.max((item.end-item.start)*PPM-2,22)
            const c=iColor(item,modeColor), isCur=item.start<=cur&&item.end>cur, isPast=item.end<=cur
            return (
              <div key={item.id+i} style={{position:'absolute',top,left:0,right:0,height:h,background:isPast?`${c}08`:isCur?`${c}1c`:`${c}0d`,border:`1px solid ${isPast?c+'10':isCur?c+'45':c+'20'}`,borderLeft:`3px solid ${isPast?c+'25':c}`,borderRadius:10,padding:'7px 10px',overflow:'hidden',transition:'all .3s',boxShadow:isCur?`0 4px 24px ${c}18`:'none',opacity:isPast?.5:1}}>
                <div style={{fontSize:11,color:isPast?th.textD:isCur?th.text:th.textC,fontWeight:isCur?500:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.title}</div>
                {h>32&&<div style={{fontSize:8,color:th.textD,marginTop:3}}>{fmtT(item.start)} → {fmtT(item.end)}</div>}
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
function PlanItem({ item, color, type, onDelete, onToggle, th }) {
  const [popped,setPopped]=useState(false)
  const c=iColor({...item,type},color)
  return (
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'13px 0',borderBottom:`1px solid ${th.borderB}`,animation:'rise .35s both'}}>
      {onToggle&&(
        <div onClick={()=>{setPopped(true);setTimeout(()=>setPopped(false),300);onToggle(item.id)}} className={popped?'pop':''} style={{width:22,height:22,borderRadius:7,flexShrink:0,border:`2px solid ${item.done?c:th.border}`,background:item.done?c:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .2s',boxShadow:item.done?`0 0 14px ${c}45`:'none'}}>
          {item.done&&<span style={{fontSize:11,color:th.dark?'#000':'#fff',fontWeight:800}}>✓</span>}
        </div>
      )}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:item.done?th.textE:th.textB,textDecoration:item.done?'line-through':'none',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.title}</div>
        <div style={{fontSize:9,color:th.textD,marginTop:4}}>{type==='fixed'?`${item.startTime} · ${item.duration}m`:type==='task'?`${item.duration}m · ${PRI[item.priority]?.label||''}`:`~${QW_MINS}m`}</div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <Chip type={type} priority={item.priority} modeColor={color}/>
        <button onClick={()=>onDelete(item.id)} style={{color:th.textE,fontSize:18,padding:'0 2px',transition:'color .2s'}} onMouseEnter={e=>e.target.style.color=th.textB} onMouseLeave={e=>e.target.style.color=th.textE}>×</button>
      </div>
    </div>
  )
}

function PlanSection({ title, accent, items, type, color, onAdd, onDelete, onToggle, empty, th }) {
  const [open,setOpen]=useState(true)
  return (
    <div style={{marginBottom:4}}>
      <div onClick={()=>setOpen(p=>!p)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',cursor:'pointer'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:3,height:14,borderRadius:2,background:accent}}/>
          <div style={{fontSize:9,color:th.textC,letterSpacing:3.5}}>{title}</div>
          <div style={{fontSize:9,color:th.textD,background:th.cardB,padding:'2px 8px',borderRadius:20,border:`1px solid ${th.border}`}}>{items.length}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={e=>{e.stopPropagation();onAdd()}} style={{background:accent,color:'#000',borderRadius:8,padding:'7px 14px',fontSize:9,fontWeight:700,letterSpacing:2,boxShadow:`0 4px 16px ${accent}35`}}>+ ADD</button>
          <div style={{color:th.textD,fontSize:12,transition:'transform .2s',transform:open?'rotate(0)':'rotate(-90deg)'}}>▾</div>
        </div>
      </div>
      {open&&(
        <div style={{padding:'0 20px',paddingBottom:items.length?8:0}}>
          {items.length===0?(
            <div style={{fontSize:9,color:th.textF,letterSpacing:2.5,padding:'16px 0',textAlign:'center'}}>{empty}</div>
          ):items.map(item=><PlanItem key={item.id} item={item} color={color} type={type} onDelete={onDelete} onToggle={onToggle} th={th}/>)}
        </div>
      )}
      <div style={{height:1,background:th.borderB,margin:'0 20px'}}/>
    </div>
  )
}

function PlanTab({ mode, onAddFixed, onAddTask, onAddQW, onDeleteFixed, onDeleteTask, onDeleteQW, onToggleTask, onToggleQW, th }) {
  return (
    <div style={{paddingBottom:110}}>
      <div style={{padding:'58px 20px 20px'}}>
        <div style={{fontSize:9,color:th.textE,letterSpacing:4,marginBottom:6}}>PLAN YOUR DAY</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:52,color:mode.color,letterSpacing:3}}>{mode.name}</div>
      </div>
      <PlanSection title="FIXED BLOCKS" accent={mode.color}     items={mode.fixedBlocks||[]} type="fixed"    color={mode.color} onAdd={onAddFixed} onDelete={onDeleteFixed} empty="ADD A COMMITMENT WITH A SET TIME" th={th}/>
      <PlanSection title="TASKS"        accent={PRI.high.color} items={mode.tasks||[]}       type="task"     color={mode.color} onAdd={onAddTask}  onDelete={onDeleteTask}  onToggle={onToggleTask} empty="ADD WHAT NEEDS DOING TODAY" th={th}/>
      <PlanSection title="QUICK WINS"   accent="#a78bfa"        items={mode.quickWins||[]}   type="quickwin" color={mode.color} onAdd={onAddQW}    onDelete={onDeleteQW}    onToggle={onToggleQW}   empty="ADD SHORT TASKS TO FILL GAPS" th={th}/>
    </div>
  )
}

// ── Guide Tab ─────────────────────────────────────────────────────────────────
function GuideTab({ th, modeColor }) {
  const sections = [
    {
      icon:'⚡',
      title:'How it works',
      body:`Wired In is built around one idea: every minute of your day should have a job.\n\nYou tell it your fixed commitments — the things locked to a specific time. Then you add tasks and quick wins — the things that need doing but have no set time. Wired In figures out where everything fits automatically, fills every gap, and shows you what to do right now.`
    },
    {
      icon:'📌',
      title:'Fixed Blocks',
      body:`A fixed block is anything that happens at a specific time and can't move. A call at 3pm. A class at 9am. The gym at 6pm.\n\nAdd it with a start time and duration. Wired In locks it into your timeline and schedules everything else around it.`,
      tip:'Add your fixed blocks first — they define the structure of your day.'
    },
    {
      icon:'✦',
      title:'Tasks',
      body:`A task is something that needs doing today but has no set time. You give it a duration and a priority — high, medium, or low.\n\nWired In automatically drops tasks into the gaps between your fixed blocks, highest priority first. If you finish one early, the next task fills the spare time.`,
      tip:'Be honest with durations. 45 mins is usually more realistic than 30.'
    },
    {
      icon:'⚡',
      title:'Quick Wins',
      body:`A quick win is anything you can knock out in about 10 minutes. Reply to an email. Check your invoices. Send a text.\n\nQuick wins fill the small gaps that are too short for a proper task. No 8-minute window goes to waste.`,
      tip:'Keep a running list. The more quick wins you have, the fewer dead gaps.'
    },
    {
      icon:'⇄',
      title:'Two Modes',
      body:`Wired In splits your day into two completely separate worlds. When you flip, the other mode disappears entirely.\n\nThe idea is mental separation. When you are in Business mode, Revision doesn't exist. When you flip to Revision, Business is gone. You are fully present in one world at a time.`,
      tip:'Flip the mode when you genuinely switch context — not every 10 minutes.'
    },
    {
      icon:'📅',
      title:'Zero Gap Scheduling',
      body:`Most people waste 20–30% of their day in unplanned gaps — the 15 minutes between a call and a meeting where nothing gets done.\n\nWired In eliminates those gaps by design. Every spare minute gets a task or a quick win automatically. You never have to decide what to do next. You just do the next thing.`,
      tip:'The more you add to your plan, the smarter the scheduling gets.'
    }
  ]

  return (
    <div style={{paddingBottom:110}}>
      <div style={{padding:'58px 20px 24px'}}>
        <div style={{fontSize:9,color:th.textE,letterSpacing:4,marginBottom:6}}>HOW IT WORKS</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:46,color:modeColor,letterSpacing:3,lineHeight:1}}>WIRED IN<br/>GUIDE</div>
      </div>

      {sections.map((s,i)=>(
        <div key={i} className="rise" style={{margin:'0 20px 16px',background:th.card,border:`1px solid ${th.border}`,borderRadius:20,padding:'22px',boxShadow:th.shadow,animationDelay:`${i*60}ms`}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
            <div style={{width:38,height:38,borderRadius:12,background:`${modeColor}18`,border:`1px solid ${modeColor}28`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{s.icon}</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:22,color:th.text,letterSpacing:1.5}}>{s.title}</div>
          </div>
          <div style={{fontSize:12,color:th.textC,lineHeight:1.85}}>
            {s.body.split('\n\n').map((p,j)=><p key={j} style={{marginBottom:j<s.body.split('\n\n').length-1?12:0}}>{p}</p>)}
          </div>
          {s.tip&&(
            <div style={{marginTop:16,padding:'12px 14px',background:`${modeColor}0e`,border:`1px solid ${modeColor}22`,borderRadius:12,display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{fontSize:10,color:modeColor,marginTop:1,flexShrink:0}}>→</span>
              <div style={{fontSize:11,color:modeColor,lineHeight:1.7}}>{s.tip}</div>
            </div>
          )}
        </div>
      ))}

      {/* Quick reference card */}
      <div style={{margin:'0 20px 16px',background:th.card,border:`1px solid ${th.border}`,borderRadius:20,padding:'22px',boxShadow:th.shadow}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:20,color:th.text,letterSpacing:1.5,marginBottom:16}}>Quick Reference</div>
        {[
          {label:'Fixed Block', desc:'Locked to a time. Everything schedules around it.', color:modeColor},
          {label:'Task', desc:'No set time. Auto-scheduled by priority into gaps.', color:PRI.high.color},
          {label:'Quick Win', desc:'~10 minutes. Fills gaps too small for a task.', color:'#a78bfa'},
        ].map((r,i)=>(
          <div key={i} style={{display:'flex',gap:12,padding:'12px 0',borderBottom:i<2?`1px solid ${th.borderB}`:'none'}}>
            <div style={{width:3,borderRadius:2,background:r.color,flexShrink:0}}/>
            <div>
              <div style={{fontSize:11,color:th.textB,fontWeight:500,marginBottom:4}}>{r.label}</div>
              <div style={{fontSize:11,color:th.textD,lineHeight:1.6}}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sheets ────────────────────────────────────────────────────────────────────
function Sheet({ onClose, children, th }) {
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:200,background:th.dark?'rgba(0,0,0,.82)':'rgba(0,0,0,.4)',backdropFilter:'blur(22px)',display:'flex',alignItems:'flex-end'}}>
      <div className="slide-up" style={{width:'100%',background:th.sheet,border:`1px solid ${th.border}`,borderRadius:'26px 26px 0 0',padding:'28px 24px 52px',maxHeight:'88dvh',overflowY:'auto',boxShadow:'0 -10px 60px rgba(0,0,0,.15)'}}>
        {children}
      </div>
    </div>
  )
}

function SHdr({ title, color, onClose, th }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
      <div style={{fontSize:9,color,letterSpacing:4}}>{title}</div>
      <button onClick={onClose} style={{color:th.textD,fontSize:26,lineHeight:1}}>×</button>
    </div>
  )
}

function TInput({ value, onChange, placeholder, onEnter, af, type='text', th }) {
  return (
    <input type={type} autoFocus={af} value={value} onChange={e=>onChange(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onEnter&&onEnter()} placeholder={placeholder}
      style={{width:'100%',background:th.input,border:`1px solid ${th.border}`,borderRadius:14,padding:'16px',color:th.text,fontSize:14,marginBottom:14,transition:'border-color .2s'}}
      onFocus={e=>e.target.style.borderColor=th.textC} onBlur={e=>e.target.style.borderColor=th.border}/>
  )
}

function DurPicker({ val, onChange, color, th, opts=[15,30,45,60,90] }) {
  return (
    <div style={{display:'flex',gap:8,marginBottom:16}}>
      {opts.map(d=><button key={d} onClick={()=>onChange(d)} style={{flex:1,borderRadius:12,background:val===d?color:th.input,color:val===d?'#000':th.textC,padding:'13px 0',fontSize:11,fontWeight:700,border:`1px solid ${val===d?color:th.border}`,boxShadow:val===d?`0 4px 16px ${color}40`:'none',transition:'all .18s'}}>{d}m</button>)}
    </div>
  )
}

function SBtn({ onClick, label, color, disabled }) {
  return (
    <button onClick={onClick} style={{width:'100%',borderRadius:16,padding:'20px',background:disabled?'#161616':color,color:disabled?'#444':'#000',fontSize:12,fontWeight:700,letterSpacing:4,boxShadow:disabled?'none':`0 8px 32px ${color}50`,transition:'all .22s'}}>
      {label}
    </button>
  )
}

function AddFixedSheet({ color, modeName, onAdd, onClose, th }) {
  const [title,setTitle]=useState(''), [time,setTime]=useState('09:00'), [dur,setDur]=useState(30)
  const ok=title.trim()
  return (
    <Sheet onClose={onClose} th={th}>
      <SHdr title={`FIXED BLOCK · ${modeName}`} color={color} onClose={onClose} th={th}/>
      <TInput value={title} onChange={setTitle} placeholder="e.g. Team call, Gym, Lecture" onEnter={()=>ok&&(onAdd({id:uid(),title:title.trim(),startTime:time,duration:dur}),onClose())} af th={th}/>
      <div style={{fontSize:9,color:th.textD,letterSpacing:3,marginBottom:10}}>START TIME</div>
      <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={{width:'100%',background:th.input,border:`1px solid ${th.border}`,borderRadius:14,padding:'16px',color:th.text,fontSize:16,marginBottom:16,colorScheme:th.dark?'dark':'light'}}/>
      <div style={{fontSize:9,color:th.textD,letterSpacing:3,marginBottom:10}}>DURATION</div>
      <DurPicker val={dur} onChange={setDur} color={color} th={th}/>
      <SBtn onClick={()=>ok&&(onAdd({id:uid(),title:title.trim(),startTime:time,duration:dur}),onClose())} label="ADD FIXED BLOCK →" color={color} disabled={!ok}/>
    </Sheet>
  )
}

function AddTaskSheet({ color, modeName, onAdd, onClose, th }) {
  const [title,setTitle]=useState(''), [dur,setDur]=useState(45), [pri,setPri]=useState('high')
  const ok=title.trim()
  return (
    <Sheet onClose={onClose} th={th}>
      <SHdr title={`TASK · ${modeName}`} color={color} onClose={onClose} th={th}/>
      <TInput value={title} onChange={setTitle} placeholder="What needs doing?" onEnter={()=>ok&&(onAdd({id:uid(),title:title.trim(),duration:dur,priority:pri,done:false}),onClose())} af th={th}/>
      <div style={{fontSize:9,color:th.textD,letterSpacing:3,marginBottom:10}}>DURATION</div>
      <DurPicker val={dur} onChange={setDur} color={color} th={th}/>
      <div style={{fontSize:9,color:th.textD,letterSpacing:3,marginBottom:10}}>PRIORITY</div>
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {['high','medium','low'].map(p=>{const inf=PRI[p];return <button key={p} onClick={()=>setPri(p)} style={{flex:1,borderRadius:12,background:pri===p?inf.color:th.input,color:pri===p?'#000':th.textC,padding:'13px 0',fontSize:11,fontWeight:700,border:`1px solid ${pri===p?inf.color:th.border}`,boxShadow:pri===p?`0 4px 16px ${inf.color}40`:'none',transition:'all .18s'}}>{inf.label}</button>})}
      </div>
      <SBtn onClick={()=>ok&&(onAdd({id:uid(),title:title.trim(),duration:dur,priority:pri,done:false}),onClose())} label="ADD TASK →" color={color} disabled={!ok}/>
    </Sheet>
  )
}

function AddQWSheet({ color, onAdd, onClose, th }) {
  const [title,setTitle]=useState('')
  const ok=title.trim()
  return (
    <Sheet onClose={onClose} th={th}>
      <SHdr title="QUICK WIN" color="#a78bfa" onClose={onClose} th={th}/>
      <div style={{fontSize:11,color:th.textD,marginBottom:18,lineHeight:1.8}}>A ~10 minute task. Wired In automatically slots these into any gaps too small for a proper task.</div>
      <TInput value={title} onChange={setTitle} placeholder="e.g. Reply to emails" onEnter={()=>ok&&(onAdd({id:uid(),title:title.trim(),done:false}),onClose())} af th={th}/>
      <SBtn onClick={()=>ok&&(onAdd({id:uid(),title:title.trim(),done:false}),onClose())} label="ADD QUICK WIN →" color="#a78bfa" disabled={!ok}/>
    </Sheet>
  )
}

function SettingsSheet({ modes, onUpdateColor, onClearAll, onSignOut, onClose, th, darkMode, onToggleDark }) {
  const [cc,setCc]=useState(false)
  return (
    <Sheet onClose={onClose} th={th}>
      <SHdr title="SETTINGS" color={th.textC} onClose={onClose} th={th}/>

      {/* Theme toggle */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 0',borderBottom:`1px solid ${th.borderB}`,marginBottom:24}}>
        <div>
          <div style={{fontSize:11,color:th.textB,marginBottom:3}}>Appearance</div>
          <div style={{fontSize:9,color:th.textD,letterSpacing:1}}>{darkMode?'DARK MODE':'LIGHT MODE'}</div>
        </div>
        <button onClick={onToggleDark} style={{background:darkMode?'#333':'#e5e4e0',borderRadius:30,width:54,height:28,position:'relative',transition:'background .3s',border:`1px solid ${th.border}`,flexShrink:0}}>
          <div style={{width:22,height:22,borderRadius:'50%',background:darkMode?'#fff':'#111',position:'absolute',top:2,left:darkMode?28:2,transition:'left .3s cubic-bezier(.16,1,.3,1)',boxShadow:'0 2px 8px rgba(0,0,0,.25)'}}/>
        </button>
      </div>

      {modes.map((m,i)=>(
        <div key={i} style={{marginBottom:28}}>
          <div style={{fontSize:9,letterSpacing:3,marginBottom:14,color:m.color}}>{m.name} — COLOUR</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {COLORS.map(c=><div key={c} onClick={()=>onUpdateColor(i,c)} style={{width:42,height:42,borderRadius:12,background:c,cursor:'pointer',border:m.color===c?'3px solid #fff':'3px solid transparent',transform:m.color===c?'scale(1.2)':'scale(1)',boxShadow:m.color===c?`0 0 20px ${c}60`:'none',transition:'all .18s'}}/>)}
          </div>
        </div>
      ))}

      <div style={{height:1,background:th.borderB,margin:'0 0 20px'}}/>
      <button onClick={()=>{if(cc){onClearAll();setCc(false);onClose()}else setCc(true)}} style={{width:'100%',border:`1px solid ${th.border}`,borderRadius:14,padding:'16px',background:cc?'rgba(248,113,113,.1)':'transparent',color:cc?'#f87171':th.textC,fontSize:11,letterSpacing:2,marginBottom:10,transition:'all .2s'}}>
        {cc?'TAP AGAIN TO CONFIRM':'CLEAR ALL TASKS & BLOCKS'}
      </button>
      <button onClick={onSignOut} style={{width:'100%',border:`1px solid ${th.border}`,borderRadius:14,padding:'16px',background:'transparent',color:th.textD,fontSize:11,letterSpacing:2,marginBottom:10}}>SIGN OUT</button>
      <button onClick={onClose} style={{width:'100%',background:th.input,border:`1px solid ${th.border}`,borderRadius:14,padding:'16px',color:th.textC,fontSize:11,letterSpacing:2}}>DONE</button>
    </Sheet>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ tab, setTab, color, th }) {
  const items=[{key:'home',icon:'⚡',label:'TODAY'},{key:'timeline',icon:'▦',label:'TIMELINE'},{key:'plan',icon:'≡',label:'PLAN'},{key:'guide',icon:'◎',label:'GUIDE'}]
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:th.nav,backdropFilter:'blur(24px)',borderTop:`1px solid ${th.navBd}`,padding:'10px 0 28px',display:'flex'}}>
      {items.map(it=>(
        <button key={it.key} onClick={()=>setTab(it.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5,padding:'8px 0'}}>
          <div style={{fontSize:16,opacity:tab===it.key?1:.25,transition:'opacity .2s'}}>{it.icon}</div>
          <div style={{fontSize:8,letterSpacing:2,color:tab===it.key?color:th.textE,transition:'color .2s'}}>{it.label}</div>
          {tab===it.key&&<div style={{width:16,height:2,borderRadius:1,background:color,marginTop:2,boxShadow:`0 0 6px ${color}`}}/>}
        </button>
      ))}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]=useState(null), [authLoading,setAuthLoading]=useState(true)
  const [isSetup,setIsSetup]=useState(false), [syncing,setSyncing]=useState(false)
  const [modes,setModes]=useState([{name:'BUSINESS',color:'#00d4ff',fixedBlocks:[],tasks:[],quickWins:[]},{name:'REVISION',color:'#ff6b35',fixedBlocks:[],tasks:[],quickWins:[]}])
  const [active,setActive]=useState(0), [tab,setTab]=useState('home')
  const [darkMode,setDarkMode]=useState(()=>{try{return localStorage.getItem('wi_dark')!=='false'}catch{return true}})
  const [flipping,setFlipping]=useState(false), [flipPhase,setFlipPhase]=useState('in'), [ck,setCk]=useState(0)
  const [settings,setSettings]=useState(false), [sheet,setSheet]=useState(null)

  const th = darkMode ? DARK : LIGHT

  const toggleDark = () => {
    setDarkMode(p=>{try{localStorage.setItem('wi_dark',!p)}catch{}; return !p})
  }

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s))
    return()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(!session) return
    supabase.from('wiredin_data').select('modes,active_mode').eq('user_id',session.user.id).single()
      .then(({data,error})=>{if(error||!data)setIsSetup(true);else{setModes(data.modes);setActive(data.active_mode);setIsSetup(false)}})
  },[session])

  const sync=useCallback(async(m,a)=>{
    if(!session) return; setSyncing(true)
    await supabase.from('wiredin_data').upsert({user_id:session.user.id,modes:m,active_mode:a,updated_at:new Date().toISOString()})
    setSyncing(false)
  },[session])

  useEffect(()=>{
    if(!session||isSetup) return
    const t=setTimeout(()=>sync(modes,active),800); return()=>clearTimeout(t)
  },[modes,active,session,isSetup,sync])

  const flip=useCallback(()=>{
    if(flipping) return; setFlipping(true); setFlipPhase('out')
    setTimeout(()=>{setActive(p=>p===0?1:0);setCk(p=>p+1);setFlipPhase('in');setTimeout(()=>setFlipping(false),380)},320)
  },[flipping])

  const upd=useCallback(fn=>setModes(p=>p.map((m,i)=>i===active?fn(m):m)),[active])
  const addFixed=b=>upd(m=>({...m,fixedBlocks:[...m.fixedBlocks,b]}))
  const delFixed=id=>upd(m=>({...m,fixedBlocks:m.fixedBlocks.filter(b=>b.id!==id)}))
  const addTask=t=>upd(m=>({...m,tasks:[...m.tasks,t]}))
  const delTask=id=>upd(m=>({...m,tasks:m.tasks.filter(t=>t.id!==id)}))
  const togTask=id=>upd(m=>({...m,tasks:m.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}))
  const addQW=q=>upd(m=>({...m,quickWins:[...m.quickWins,q]}))
  const delQW=id=>upd(m=>({...m,quickWins:m.quickWins.filter(q=>q.id!==id)}))
  const togQW=id=>upd(m=>({...m,quickWins:m.quickWins.map(q=>q.id===id?{...q,done:!q.done}:q)}))
  const updColor=(mi,c)=>setModes(p=>p.map((m,i)=>i===mi?{...m,color:c}:m))
  const clearAll=()=>setModes(p=>p.map(m=>({...m,tasks:[],quickWins:[],fixedBlocks:[]})))
  const signOut=()=>supabase.auth.signOut()
  const completeSetup=async nm=>{setModes(nm);setIsSetup(false);await supabase.from('wiredin_data').upsert({user_id:session.user.id,modes:nm,active_mode:0,updated_at:new Date().toISOString()})}

  if(authLoading) return <div style={{minHeight:'100dvh',background:'#070707',display:'flex',alignItems:'center',justifyContent:'center'}}><style>{CSS}</style><Spinner/></div>
  if(!session) return <><style>{CSS}</style><AuthScreen/></>
  if(isSetup)  return <><style>{CSS}</style><Setup onComplete={completeSetup}/></>

  const mode=modes[active], other=modes[active===0?1:0], timeline=buildTimeline(mode)

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100dvh',background:th.bg,overflowX:'hidden',transition:'background .4s ease'}}>

        {/* Ambient — dark only */}
        {th.dark&&<>
          <div style={{position:'fixed',inset:0,pointerEvents:'none',background:`radial-gradient(ellipse 110% 45% at 50% 0%,${mode.color}14 0%,transparent 65%)`,transition:'background .8s'}}/>
          <div style={{position:'fixed',bottom:0,left:0,right:0,height:'25%',pointerEvents:'none',background:`radial-gradient(ellipse 90% 100% at 50% 100%,${mode.color}06 0%,transparent 70%)`,transition:'background .8s'}}/>
        </>}

        {/* Sync */}
        {syncing&&<div style={{position:'fixed',top:16,right:16,zIndex:300,display:'flex',alignItems:'center',gap:6}}><div className="spin" style={{width:10,height:10,border:'1.5px solid #333',borderTopColor:mode.color,borderRadius:'50%'}}/><span style={{fontSize:8,color:th.textE,letterSpacing:2}}>SYNCING</span></div>}

        {/* Content */}
        <div key={ck} className={flipPhase==='out'?'flip-out':'flip-in'} style={{minHeight:'100dvh',overflowY:'auto'}}>
          {tab==='home'&&<HomeTab mode={mode} timeline={timeline} onFlip={flip} other={other} onSettings={()=>setSettings(true)} th={th} darkMode={darkMode} onToggleDark={toggleDark}/>}
          {tab==='timeline'&&<TimelineTab timeline={timeline} modeColor={mode.color} mode={mode} th={th}/>}
          {tab==='plan'&&<PlanTab mode={mode} onAddFixed={()=>setSheet('fixed')} onAddTask={()=>setSheet('task')} onAddQW={()=>setSheet('qw')} onDeleteFixed={delFixed} onDeleteTask={delTask} onDeleteQW={delQW} onToggleTask={togTask} onToggleQW={togQW} th={th}/>}
          {tab==='guide'&&<GuideTab th={th} modeColor={mode.color}/>}
        </div>

        <Nav tab={tab} setTab={setTab} color={mode.color} th={th}/>

        {sheet==='fixed'&&<AddFixedSheet color={mode.color} modeName={mode.name} onAdd={addFixed} onClose={()=>setSheet(null)} th={th}/>}
        {sheet==='task' &&<AddTaskSheet  color={mode.color} modeName={mode.name} onAdd={addTask}  onClose={()=>setSheet(null)} th={th}/>}
        {sheet==='qw'   &&<AddQWSheet    color={mode.color}                       onAdd={addQW}    onClose={()=>setSheet(null)} th={th}/>}
        {settings&&<SettingsSheet modes={modes} onUpdateColor={updColor} onClearAll={clearAll} onSignOut={signOut} onClose={()=>setSettings(false)} th={th} darkMode={darkMode} onToggleDark={toggleDark}/>}
      </div>
    </>
  )
}
