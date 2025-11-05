const params = new URLSearchParams(location.search);
const scenario = params.get('scenario') || 'oncity';
const STORAGE_KEY = `sim_go_nogo_${scenario}_v1`;

let CONFIG = null;
let state = {
  equipo:"", integrantes:[], paso:"PASO_0",
  intentos: {}, 
  data:{ som:null, modelo:"", aov:null, margen:null, cac:null, ltv:null, burn:null, runway:null, breakeven:null },
  historial:[]
};

const chat = document.getElementById('chat');
const stepBadge = document.getElementById('stepBadge');
const agentTitle = document.getElementById('agentTitle');
const agentAvatar = document.getElementById('agentAvatar');

fetch(`./configs/${scenario}.json`).then(r=>r.json()).then(cfg => {
  CONFIG = cfg;
  // Theming
  if(cfg.theme?.brand){ document.documentElement.style.setProperty('--brand', cfg.theme.brand); }
  if(cfg.theme?.link){ document.documentElement.style.setProperty('--link', cfg.theme.link); }
  // Avatar
  if(cfg.avatar?.url){
    document.documentElement.style.setProperty('--avatar-url', `url('${cfg.avatar.url}')`);
    document.documentElement.style.setProperty('--avatar-pos', cfg.avatar.pos || '0% 50%');
  }
  agentTitle.textContent = cfg.title;
  saludoInicial();
  renderPaso();
}).catch(_ => {
  agentTitle.textContent = "Agente (config no encontrada)";
  post('bot', "No encontré configuración del agente. Verificá la URL.");
});

function saludoInicial(){
  post('bot', `Soy ${CONFIG.role}. Guiaré 5 pasos para decidir **Go / No Go**. Tiempo estimado: 20–25 min.\nEscribí **validar** para iniciar o **ayuda** para requisitos.`);
}
function post(role, text){
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + (role==='user'?'user':'');
  const b = document.createElement('div');
  b.className = 'bubble ' + (role==='user'?'user':'bot');
  b.textContent = text;
  wrap.appendChild(b);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  state.historial.push({t: Date.now(), role, text});
}
function renderPaso(){ stepBadge.textContent = state.paso; }

function guardar(){
  state.equipo = document.getElementById('equipo').value.trim();
  state.integrantes = document.getElementById('integrantes').value.split(',').map(s=>s.trim()).filter(Boolean);
  const fields = ['som','modelo','aov','margen','cac','ltv','burn','runway','breakeven'];
  for(const f of fields){
    const el = document.getElementById(f);
    let v = el.value.trim();
    if(['som','aov','margen','cac','ltv','burn','runway','breakeven'].includes(f)){
      v = v===''? null : Number(v);
    }
    state.data[f] = (f==='modelo') ? el.value.trim() : v;
  }
  try{ state = Object.assign(state, JSON.parse(document.getElementById('json').value)); }catch{}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  post('bot', "Guardado local.");
}
function cargar(){
  try{
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY)||"");
    if(s){ state = s; post('bot',"Cargado."); }
  }catch{ post('bot',"No hay datos o están corruptos."); }
  renderPaso();
  document.getElementById('json').value = JSON.stringify(state, null, 2);
}
function exportar(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `equipo_${(state.equipo||'sin_nombre').replace(/\s+/g,'_')}.json`;
  a.click();
}
function descargarPDF(){
  const w = window.open('', '_blank');
  const esc = (s)=> String(s).replace(/[&<>]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
  const rows = state.historial.map(h=>`<div class="row"><strong>${h.role==='user'?'Equipo':'Director'}:</strong> ${esc(h.text)}</div>`).join('');
  w.document.write(`
    <html><head><meta charset="utf-8"><title>Transcripción — ${esc(state.equipo||'equipo')}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px} .row{margin:8px 0} h1{font-size:18px}</style>
    </head><body>
      <h1>Transcripción — ${esc(state.equipo||'equipo')}</h1>
      <div><em>Agente:</em> ${esc(CONFIG.title)} — <em>Escenario:</em> ${esc(CONFIG.scenario||'')}</div>
      <hr/>
      <h2>Chat</h2>
      ${rows||'<em>Sin mensajes</em>'}
      <hr/>
      <h2>Resumen de datos</h2>
      <pre>${esc(JSON.stringify(state.data,null,2))}</pre>
      <h2>Decisión</h2>
      <div>${esc(state.decision||'—')}</div>
      <script>window.print();</script>
    </body></html>
  `);
  w.document.close();
}
function send(){
  const input = document.getElementById('msg');
  const text = (input.value||"").trim();
  if(!text) return;
  post('user', text);
  input.value='';
  process(text);
}
function process(text){
  if(/^reset$/i.test(text)){ state = {equipo:"",integrantes:[],paso:"PASO_0",intentos:{},data:state.data,historial:[]}; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderPaso(); post('bot',"Contexto reiniciado. Escribí **validar**."); return; }
  if(/^(ayuda|help)$/i.test(text)){ post('bot', CONFIG.help[state.paso] || CONFIG.help.default); return; }
  if(text.trim().startsWith('{')){ try{ state = Object.assign(state, JSON.parse(text)); post('bot',"JSON incorporado. Escribí **validar**."); return; }catch{ post('bot',"JSON inválido."); return; } }
  if(/^validar$/i.test(text)){ return validarPaso(); }

  const rules = CONFIG.rules[state.paso] || [];
  for(const r of rules){
    const re = new RegExp(r.trigger, 'i');
    if(re.test(text)){
      if(r.hint) post('bot', r.hint);
      if(r.set){ for(const [k,v] of Object.entries(r.set)){ state.data[k] = v; } }
      if(r.next){ state.paso = r.next; renderPaso(); }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if(r.reply) post('bot', r.reply);
      return;
    }
  }
  post('bot', "No tengo una respuesta preconfigurada para eso. Escribí **ayuda** o completá el panel y **validar**.");
}
function validarPaso(){
  const d = state.data;
  const inc = (k)=>{ state.intentos[k]=(state.intentos[k]||0)+1; return state.intentos[k]; }

  if(state.paso==='PASO_0'){
    state.paso='PASO_1'; renderPaso();
    post('bot', CONFIG.prompts.PASO_1);
    return;
  }
  if(state.paso==='PASO_1'){
    let ok = d.som!=null && d.modelo;
    if(!ok){
      const i = inc('P1');
      if(i<3) post('bot', "Faltan **SOM (%)** y/o **modelo** (stock/dropship/marketplace). Completá y **validar**.");
      else { post('bot', "No se logró completar PASO 1. Se marca nulo y afectará la decisión."); d.som = d.som ?? null; d.modelo = d.modelo || ""; }
      return;
    }
    state.paso='PASO_2'; renderPaso();
    post('bot', CONFIG.prompts.PASO_2);
    return;
  }
  if(state.paso==='PASO_2'){
    const need = ['aov','margen','cac','ltv'];
    const faltan = need.filter(k => d[k]===null || Number.isNaN(d[k]));
    if(faltan.length){
      const i = inc('P2');
      if(i<3) post('bot', `Faltan métricas: ${faltan.join(', ')}. Completá y **validar**.`);
      else post('bot', "Intentos superados en PASO 2. Se consideran nulas las faltantes.");
      return;
    }
    state.paso='PASO_3'; renderPaso();
    post('bot', CONFIG.prompts.PASO_3);
    return;
  }
  if(state.paso==='PASO_3'){
    const need = ['burn','runway'];
    const faltan = need.filter(k => d[k]===null || Number.isNaN(d[k]));
    if(faltan.length){
      const i = inc('P3');
      if(i<3) post('bot', `Falta: ${faltan.join(', ')}. Indicá **cash burn** y **runway (meses)**.`);
      else post('bot', "Intentos superados en PASO 3. Se asumen nulas.");
      return;
    }
    state.paso='PASO_4'; renderPaso();
    post('bot', CONFIG.prompts.PASO_4);
    return;
  }
  if(state.paso==='PASO_4'){
    if(d.breakeven===null || Number.isNaN(d.breakeven)){
      const i = inc('P4');
      if(i<3) post('bot', "Indicá **break-even (meses)**. Si no pueden estimarlo, den un rango razonable.");
      else post('bot', "Intentos superados en PASO 4. Se asume nulo.");
      return;
    }
    state.paso='PASO_5'; renderPaso();
    post('bot', "Listo. Escribí **validar** para calcular **Go / No Go**.");
    return;
  }
  if(state.paso==='PASO_5'){
    const th = CONFIG.thresholds;
    let score = 0, checks = [];
    if(d.margen!=null && d.margen>=th.margen_min){ score++; checks.push("Margen OK"); } else checks.push("Margen Bajo");
    if(d.cac!=null && d.ltv!=null && d.ltv >= th.ltv_cac_ratio * d.cac){ score++; checks.push("LTV/CAC OK"); } else checks.push("LTV/CAC Bajo");
    if(d.runway!=null && d.runway >= th.runway_min){ score++; checks.push("Runway OK"); } else checks.push("Runway Corto");
    if(d.breakeven!=null && d.breakeven <= th.breakeven_max){ score++; checks.push("Break-even OK"); } else checks.push("Break-even Lento");
    if(d.som!=null && d.som >= th.som_min){ score++; checks.push("SOM OK"); } else checks.push("SOM Insuficiente");

    const go = score >= th.min_score;
    state.decision = (go? "GO ✅":"NO GO ⛔") + ` (${score}/5) — ${checks.join(' | ')}`;
    post('bot', `Decisión: ${state.decision}\nSugerencia: ${go? CONFIG.go_advice: CONFIG.nogo_advice}`);
    return;
  }
}