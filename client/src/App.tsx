import { useEffect, useMemo, useRef, useState } from 'react';

import { AudioLines, WandSparkles, Upload, Play, Download, History, Heart, LogIn, LogOut, Mic2, FileText, ShieldCheck, RefreshCw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type User = {id:string;name:string;email:string;role:string};

type Voice = {name:string;languageCodes:string[];gender:string};

type Job = {id:string;text:string;language:string;voice:string;audioUrl:string;playbackUrl?:string;characterCount:number;favorite:boolean;createdAt:string};

export default function App(){

 const [token,setToken]=useState(localStorage.getItem('tts_token')||'');

 const [user,setUser]=useState<User|null>(JSON.parse(localStorage.getItem('tts_user')||'null'));

 const [authMode,setAuthMode]=useState<'login'|'register'>('login'); const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState('');

 const [text,setText]=useState('Welcome to VoxStudio. Turn your text into natural-sounding speech in just a few clicks.');

 const [language,setLanguage]=useState('en-US'); const [voice,setVoice]=useState(''); const [voices,setVoices]=useState<Voice[]>([]); const [rate,setRate]=useState(1); const [pitch,setPitch]=useState(0);

 const [audioUrl,setAudioUrl]=useState(''); const audioRef=useRef<HTMLAudioElement|null>(null); const [history,setHistory]=useState<Job[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [tab,setTab]=useState<'studio'|'history'|'admin'>('studio'); const [usage,setUsage]=useState<{used:number;limit:number}|null>(null); const [adminMetrics,setAdminMetrics]=useState<any>(null);

 const headers=useMemo(()=>({ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }),[token]);

 async function api(path:string, init:RequestInit={}){const r=await fetch(`${API}${path}`,{...init,headers:{...headers,...init.headers}});const d=r.status===204?null:await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||`Request failed (${r.status})`);return d;}

 function saveSession(d:any){setToken(d.token);setUser(d.user);localStorage.setItem('tts_token',d.token);localStorage.setItem('tts_user',JSON.stringify(d.user));setError('');setNotice(`Welcome${d.user.name?`, ${d.user.name}`:''}!`);}

 async function authenticate(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const d=await api(`/auth/${authMode}`,{method:'POST',body:JSON.stringify(authMode==='register'?{name,email,password}:{email,password})});saveSession(d);}catch(e:any){setError(e.message)}finally{setBusy(false)}}

 async function loadVoices() {
  try {
    const d = await api(`/tts/voices?language=${encodeURIComponent(language)}`);
    const list: Voice[] = d.voices || [];
    setVoices(list);
    setVoice((old) => list.some((item) => item.name === old) ? old : (list[0]?.name || ""));
  } catch (e: any) {
    setVoices([]);
    setVoice("");
    setError(e.message || "Could not load local Piper voices.");
  }
}

async function loadHistory() {
  try {
    const d = await api("/history");
    const items: Job[] = d.history || [];
    const withAudio = await Promise.all(
      items.map(async (job) => {
        try {
          const r = await fetch(`${API.replace(/\/api$/, "")}${job.audioUrl}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) return job;
          return { ...job, playbackUrl: URL.createObjectURL(await r.blob()) };
        } catch {
          return job;
        }
      })
    );
    setHistory(withAudio);
  } catch (e: any) {
    setError(e.message || "Could not load your library.");
  }
}

useEffect(() => {
  if (token) {
    loadVoices();
    loadHistory();
  }
}, [token, language]);

async function generate() {
  setError("");
  setNotice("");
  if (!text.trim()) {
    setError("Enter some text before generating speech.");
    return;
  }

  setBusy(true);
  try {
    const d = await api("/tts", {
      method: "POST",
      body: JSON.stringify({
        text: text.trim(),
        language,
        voice,
        speakingRate: rate,
        pitch,
      }),
    });

    if (!d.job?.audioUrl) {
      throw new Error("The server did not return an audio URL.");
    }

    // The API may return /api/audio/... or /audio/... depending on backend configuration.
    const audioPath = d.job.audioUrl.startsWith("/api/")
      ? `${API.replace(/\/api$/, "")}${d.job.audioUrl}`
      : d.job.audioUrl.startsWith("/audio/")
        ? `${API}${d.job.audioUrl}`
        : d.job.audioUrl.startsWith("http")
          ? d.job.audioUrl
          : `${API}/${d.job.audioUrl.replace(/^\//, "")}`;

    const response = await fetch(audioPath, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details?.error || `Could not retrieve generated audio (${response.status}).`);
    }

    const blob = await response.blob();
    if (!blob.size) throw new Error("The generated audio file is empty.");

    setAudioUrl((oldUrl) => {
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      return URL.createObjectURL(blob);
    });
    if (d.usage) setUsage(d.usage);
    setNotice("Speech generated successfully with local Piper. Play it below or download the WAV file.");
    await loadHistory();
  } catch (e: any) {
    setError(e.message || "Speech generation failed.");
  } finally {
    setBusy(false);
  }
}

function pauseOrResumeSpeech() {
  const player = audioRef.current;
  if (!player) return;
  if (player.paused) {
    void player.play().catch(() => setError("Could not resume audio playback. Press Play on the audio player."));
    setNotice("Audio playback resumed.");
  } else {
    player.pause();
    setNotice("Audio playback paused.");
  }
}

function stopSpeech() {
  const player = audioRef.current;
  if (player) {
    player.pause();
    player.currentTime = 0;
  }
  setNotice("Audio playback stopped.");
}

async function uploadFile(file?:File){if(!file)return;setBusy(true);setError('');setNotice('');try{const fd=new FormData();fd.append('file',file);const r=await fetch(`${API}/documents/extract`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not extract document text');setText(d.text);setNotice(`Text extracted from ${d.fileName}${d.truncated?' (trimmed to the configured character limit)':''}.`);setTab('studio')}catch(e:any){setError(e.message)}finally{setBusy(false)}}

 async function enhance(style:string){setBusy(true);setError('');try{const d=await api('/ai/enhance',{method:'POST',body:JSON.stringify({text,style})});setText(d.text);setNotice('Text enhanced. Review it before generating audio.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}

 async function favorite(job:Job){try{await api(`/history/${job.id}/favorite`,{method:'PATCH'});await loadHistory()}catch(e:any){setError(e.message)}}

 async function removeJob(job:Job){try{await api(`/history/${job.id}`,{method:'DELETE'});await loadHistory()}catch(e:any){setError(e.message)}}

 function logout(){setToken('');setUser(null);localStorage.removeItem('tts_token');localStorage.removeItem('tts_user');setHistory([]);setAudioUrl('');setNotice('Signed out successfully.')}

 async function showAdmin(){setTab('admin');setError('');try{const d=await api('/admin/metrics');setAdminMetrics(d);setNotice('Admin metrics refreshed.')}catch(e:any){setError(e.message)}}

 const words=text.trim()?text.trim().split(/\s+/).length:0;

 if(!token||!user)return <main className="auth-shell"><div className="auth-art"><div className="brand"><span className="brand-icon"><AudioLines/></span> VoxStudio</div><div className="art-copy"><span className="eyebrow">YOUR WORDS, YOUR VOICE</span><h1>Give your ideas<br/>a <em>voice.</em></h1><p>Transform documents and text into clear, expressive audio with a studio built for listening.</p><div className="soundwave">{Array.from({length:42},(_,i)=><i key={i} style={{height:`${10+Math.abs(Math.sin(i*.61))*42}px`}}/>)}</div><small>CREATE · LISTEN · LEARN</small></div></div><div className="auth-panel"><form className="auth-card" onSubmit={authenticate}><span className="eyebrow">WELCOME TO VOXSTUDIO</span><h2>{authMode==='login'?'Welcome back':'Create your account'}</h2><p className="muted">{authMode==='login'?'Sign in to continue to your audio workspace.':'Start turning written content into speech.'}</p>{authMode==='register'&&<label>Full name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}<label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>{error&&<div className="alert error">{error}</div>}<button className="primary wide" disabled={busy}>{busy?'Please wait…':authMode==='login'?'Sign in':'Create account'} <LogIn size={16}/></button><p className="switch-auth">{authMode==='login'?"New to VoxStudio?":"Already have an account?"} <button type="button" className="text-button" onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setError('')}}>{authMode==='login'?'Create an account':'Sign in'}</button></p><p className="security-note"><ShieldCheck size={15}/> Your workspace is private to your account.</p></form></div></main>;

 return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-icon"><AudioLines/></span> VoxStudio</div><div className="workspace-label">WORKSPACE</div><button className={`nav-item ${tab==='studio'?'active':''}`} onClick={()=>setTab('studio')}><Mic2 size={18}/> Speech studio</button><button className={`nav-item ${tab==='history'?'active':''}`} onClick={()=>{setTab('history');loadHistory()}}><History size={18}/> My library <span className="nav-count">{history.length}</span></button>{user.role==='ADMIN'&&<button className={`nav-item ${tab==='admin'?'active':''}`} onClick={showAdmin}><ShieldCheck size={18}/> Admin analytics</button>}<div className="sidebar-bottom"><div className="usage-card"><div className="usage-top"><span>Monthly usage</span><span>{usage?Math.round(usage.used/usage.limit*100):0}%</span></div><div className="usage-track"><div style={{width:`${usage?Math.min(100,usage.used/usage.limit*100):0}%`}}/></div><small>{usage?`${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()} characters`:'Usage shown after first generation'}</small></div><div className="profile"><div className="avatar">{user.name?.slice(0,1).toUpperCase()||user.email.slice(0,1).toUpperCase()}</div><div className="profile-copy"><strong>{user.name||'Your account'}</strong><small>{user.email}</small></div><button className="icon-button" title="Sign out" onClick={logout}><LogOut size={17}/></button></div></div></aside><main className="main-area"><header className="topbar"><div><div className="breadcrumb">WORKSPACE <span>/</span> {tab==='studio'?'SPEECH STUDIO':tab==='history'?'MY LIBRARY':'ADMIN ANALYTICS'}</div><h2>{tab==='studio'?'Speech studio':tab==='history'?'Your audio library':'Admin analytics'}</h2></div><div className="top-actions"><span className="status-dot">Local Piper speech engine</span><div className="avatar small">{user.name?.slice(0,1).toUpperCase()||'U'}</div></div></header><div className="content">{error&&<div className="alert error"><span>{error}</span><button onClick={()=>setError('')}>×</button></div>}{notice&&<div className="alert success"><span>{notice}</span><button onClick={()=>setNotice('')}>×</button></div>}

 {tab==='studio'&&<><section className="hero"><div><span className="eyebrow">A LITTLE MAGIC FOR YOUR WORDS</span><h1>Make your text<br/> <em>come alive.</em></h1><p>Turn notes, articles, and documents into audio you can listen to anywhere.</p></div><div className="hero-orb"><div className="orb-ring ring-one"/><div className="orb-ring ring-two"/><AudioLines size={58}/><span className="orb-dot dot-one"/><span className="orb-dot dot-two"/></div></section><div className="studio-grid"><section className="panel editor-panel"><div className="panel-heading"><div><span className="step-tag">01 / INPUT</span><h3>Your script</h3></div><label className="upload-button"><Upload size={16}/> Upload document<input type="file" accept=".txt,.pdf,.docx" onChange={e=>uploadFile(e.target.files?.[0])}/></label></div><textarea className="script-input" maxLength={5000} value={text} onChange={e=>setText(e.target.value)} placeholder="Paste or type the text you want to hear…"/><div className="editor-footer"><span><FileText size={14}/> {words} words · {text.length}/5000 characters</span><button className="text-button" onClick={()=>setText('')}>Clear text</button></div><div className="enhance-row"><div><WandSparkles size={17}/><div><strong>AI text enhancement</strong><small>Fine-tune your script for listening</small></div></div><select aria-label="AI enhancement style" defaultValue="conversational" id="enhance-style"><option value="conversational">Natural & conversational</option><option value="clearer">Improve clarity</option><option value="summarize">Summarize</option><option value="grammar">Fix grammar</option></select><button className="secondary" disabled={busy||!text.trim()} onClick={()=>enhance((document.getElementById('enhance-style') as HTMLSelectElement).value)}><WandSparkles size={15}/> Enhance</button></div></section><section className="panel settings-panel"><div className="panel-heading"><div><span className="step-tag">02 / VOICE</span><h3>Voice settings</h3></div><span className="setting-icon"><Mic2 size={18}/></span></div><label className="field-label">LANGUAGE</label><select className="field" value={language} onChange={e=>{setLanguage(e.target.value);setVoice('')}}><option value="en-US">English (United States)</option><option value="en-GB">English (United Kingdom)</option><option value="en-IN">English (India)</option><option value="hi-IN">Hindi (India)</option><option value="es-ES">Spanish</option><option value="fr-FR">French</option><option value="de-DE">German</option><option value="it-IT">Italian</option><option value="pt-BR">Portuguese (Brazil)</option><option value="ja-JP">Japanese</option></select><label className="field-label">VOICE</label><select className="field" value={voice} onChange={e=>setVoice(e.target.value)}><option value="">Provider default voice</option>{voices.map(v=><option key={v.name} value={v.name}>{v.name} · {v.gender}</option>)}</select><div className="range-heading"><label className="field-label">SPEAKING SPEED</label><span>{rate.toFixed(2)}×</span></div><input className="range" type="range" min="0.5" max="2" step="0.05" value={rate} onChange={e=>setRate(Number(e.target.value))}/><div className="range-labels"><span>Slower</span><span>Faster</span></div><div className="range-heading pitch-heading"><label className="field-label">PITCH</label><span>{pitch>0?'+':''}{pitch}</span></div><input className="range" type="range" min="-10" max="10" step="1" value={pitch} onChange={e=>setPitch(Number(e.target.value))}/><div className="range-labels"><span>Lower</span><span>Higher</span></div><button className="primary generate-button" disabled={busy||!text.trim()} onClick={generate}>{busy?<><RefreshCw className="spin" size={17}/> Working…</>:<><WandSparkles size={17}/> Generate speech <span>→</span></>}</button><div className="speech-controls" style={{display:"flex",gap:"8px",marginTop:"10px"}}><button type="button" className="secondary" onClick={pauseOrResumeSpeech} disabled={!audioUrl}><Play size={15}/> Pause / resume</button><button type="button" className="secondary" onClick={stopSpeech} disabled={!audioUrl}>Stop speech</button></div><p className="fine-print">Speech is generated locally by Piper; no Google Cloud billing is needed.</p></section></div>{audioUrl&&<section className="panel audio-panel"><div className="audio-art"><AudioLines size={30}/></div><div className="audio-info"><span className="step-tag">03 / YOUR AUDIO</span><h3>Speech generated successfully</h3><p>Your audio is ready to play or save.</p><audio ref={audioRef} controls src={audioUrl} onPlay={() => setNotice("Playing generated WAV audio.")} onEnded={() => setNotice("Audio playback finished.")}/></div><a className="download-button" href={audioUrl} download="voxstudio-speech.wav"><Download size={17}/> Download WAV</a></section>}<div className="bottom-note"><span><ShieldCheck size={16}/> Built for focused listening</span><span>TXT · PDF · DOCX</span></div></>}

 {tab==='history'&&<section className="panel history-panel"><div className="panel-heading"><div><span className="step-tag">YOUR COLLECTION</span><h3>Previously generated speech</h3></div><button className="secondary" onClick={loadHistory}><RefreshCw size={15}/> Refresh</button></div>{history.length===0?<div className="empty-state"><History size={35}/><h3>Your library is waiting</h3><p>Generate your first audio clip in the Speech Studio and it will appear here.</p><button className="primary" onClick={()=>setTab('studio')}>Go to studio →</button></div>:<div className="history-list">{history.map(job=><div className="history-item" key={job.id}><div className="history-symbol"><AudioLines size={20}/></div><div className="history-details"><strong>{job.text.slice(0,75)}{job.text.length>75?'…':''}</strong><small>{job.language} · {job.characterCount} characters · {new Date(job.createdAt).toLocaleString()}</small><audio controls preload="none" src={job.playbackUrl||''}/></div><button className={`icon-button ${job.favorite?'favorited':''}`} title="Toggle favorite" onClick={()=>favorite(job)}><Heart size={18} fill={job.favorite?'currentColor':'none'}/></button><button className="text-button delete-button" onClick={()=>removeJob(job)}>Delete</button></div>)}</div>}</section>}

 {tab==='admin'&&<section className="panel admin-panel"><div className="panel-heading"><div><span className="step-tag">OVERVIEW</span><h3>Application usage</h3></div><button className="secondary" onClick={showAdmin}><RefreshCw size={15}/> Refresh metrics</button></div>{adminMetrics?<><div className="metric-grid"><div className="metric-card"><small>REGISTERED USERS</small><strong>{adminMetrics.users}</strong></div><div className="metric-card"><small>SPEECH JOBS</small><strong>{adminMetrics.jobs}</strong></div><div className="metric-card"><small>CHARACTERS GENERATED</small><strong>{Number(adminMetrics.charactersGenerated).toLocaleString()}</strong></div></div><h3 className="subheading">Popular languages</h3><div className="language-list">{(adminMetrics.popularLanguages||[]).map((item:any)=><div className="language-row" key={item.language}><span>{item.language}</span><div className="language-track"><div style={{width:`${Math.max(5,(item._count.language/Math.max(1,adminMetrics.jobs))*100)}%`}}/></div><strong>{item._count.language}</strong></div>)}</div><h3 className="subheading">Recent speech activity</h3><div className="recent-table">{(adminMetrics.recentJobs||[]).map((job:any)=><div className="recent-row" key={job.id}><span>{job.user.email}</span><span>{job.language}</span><span>{job.characterCount.toLocaleString()} chars</span><small>{new Date(job.createdAt).toLocaleDateString()}</small></div>)}</div></>:<p className="muted">Loading metrics…</p>}</section>}

 </div><footer className="footer">VOXSTUDIO <span>·</span> TEXT-TO-SPEECH WORKSPACE <span className="footer-right">Listen a little differently.</span></footer></main></div>

}
