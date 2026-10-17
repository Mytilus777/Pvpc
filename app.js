const $=id=>document.getElementById(id);const state={date:new Date(),hours:[],selected:null};const fmtDate=d=>new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const eur=v=>Number.isFinite(v)?`${v.toFixed(5).replace('.',',')} €/kWh`:'—';const today=new Date();today.setHours(0,0,0,0);function offset(d){return Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-today)/86400000)}function label(d){const n=offset(d);return n===0?'Hoy':n===-1?'Ayer':n===1?'Mañana':n===-2?'Anteayer':n===2?'Pasado mañana':''}function classify(v,all){const vals=all.map(x=>x.pvpc).filter(Number.isFinite).sort((a,b)=>a-b),rank=vals.indexOf(v);return rank<Math.ceil(vals.length/3)?'cheap':rank>=Math.floor(vals.length*2/3)?'high':'mid'}
function parsePayload(json){
  let root=json?.data??json?.result??json;

  let list=root?.slots??root?.hours??root?.prices??root?.items??root?.intervals??root?.values;

  if(!Array.isArray(list)&&Array.isArray(root)) list=root;

  if(!Array.isArray(list))
    throw Error('La API respondió con un formato inesperado.');

  const arr=list.map((x,i)=>{
    let h=x.startsAt??x.hour??x.hourOfDay??x.hora??x.datetime??x.date??x.start??x.time??i;

    if(typeof h==='string'&&h.includes('T'))
      h=Number(h.slice(11,13));
    else if(typeof h==='string'&&h.includes(':'))
      h=Number(h.split(':')[0]);
    else
      h=Number(h);

    let p=Number(
      x.eurKwh??
      x.price??
      x.pvpc??
      x.value??
      x.price_eur_kwh??
      x.eurKwhWithTaxes
    );

    if(Number.isFinite(p)&&Math.abs(p)>2) p/=1000;

    return {hora:h,pvpc:p};
  })
  .filter(x=>Number.isFinite(x.hora)&&Number.isFinite(x.pvpc))
  .sort((a,b)=>a.hora-b.hora);

  if(!arr.length)
    throw Error('No hay precios horarios para esta fecha.');

  return arr;
}

async function getData(d){const date=iso(d);const url=`https://energialert.com/v1/prices?date=${encodeURIComponent(date)}&market=pvpc`;const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(r.status===404?'La fuente no tiene datos para esa fecha.':'No se pudo consultar la fuente de precios. Comprueba la conexión.');const json=await r.json();if(json.success===false)throw Error(json.message||json.error||'La fuente no dispone de datos para esa fecha.');return{hours:parsePayload(json),updated:json.data?.updatedAt||json.updatedAt||json.data?.updated_at||null}}
function render(){ $('datevalue').textContent=fmtDate(state.date);$('daylabel').textContent=label(state.date)||'Fecha elegida';const data=state.hours.filter(h=>Number.isFinite(h.pvpc)),vals=data.map(h=>h.pvpc);if(!data.length){$('avg').textContent=$('min').textContent=$('max').textContent='—';$('minhour').textContent=$('maxhour').textContent='';$('chart').innerHTML='';$('hours').innerHTML='';return}const avg=vals.reduce((a,b)=>a+b,0)/vals.length,min=Math.min(...vals),max=Math.max(...vals),minH=data.find(h=>h.pvpc===min),maxH=data.find(h=>h.pvpc===max);$('avg').textContent=eur(avg);$('min').textContent=eur(min);$('max').textContent=eur(max);$('minhour').textContent=`${String(minH.hora).padStart(2,'0')}:00–${String((minH.hora+1)%24).padStart(2,'0')}:00`;$('maxhour').textContent=`${String(maxH.hora).padStart(2,'0')}:00–${String((maxH.hora+1)%24).padStart(2,'0')}:00`;const lo=Math.min(0,...vals),hi=Math.max(...vals),range=hi-lo||1;$('chart').innerHTML=data.map(h=>{const c=classify(h.pvpc,data),height=10+((h.pvpc-lo)/range)*82;return`<div class="barwrap" title="${h.hora}:00 · ${eur(h.pvpc)}"><div class="bar ${c} ${state.selected===h.hora?'selected':''}" data-hour="${h.hora}" style="height:${height}%"></div><span class="xlabel">${h.hora%3===0?String(h.hora).padStart(2,'0'):''}</span></div>`}).join('');$('hours').innerHTML=data.map(h=>{const c=classify(h.pvpc,data);return`<button class="hourrow ${c} ${state.selected===h.hora?'active':''}" data-hour="${h.hora}"><span class="hourtime">${String(h.hora).padStart(2,'0')}:00–${String((h.hora+1)%24).padStart(2,'0')}:00</span><span class="hourprice">${eur(h.pvpc)}</span></button>`}).join('');document.querySelectorAll('[data-hour]').forEach(el=>el.addEventListener('click',()=>{state.selected=Number(el.dataset.hour);render()}))}
async function load(){$('notice').className='notice';$('notice').textContent='Consultando precios PVPC…';state.hours=[];try{const j=await getData(state.date);state.hours=j.hours;state.selected=null;const stamp=j.updated?` · Actualizado: ${new Date(j.updated).toLocaleString('es-ES')}`:'';$('notice').textContent=`Datos horarios recibidos de la API${stamp}. Los precios de mañana solo estarán disponibles tras su publicación.`;render()}catch(e){$('notice').className='notice error';$('notice').textContent=e.message;render()}const d=offset(state.date);$('prev').disabled=d<=-2;$('next').disabled=d>=2}
$('prev').addEventListener('click',()=>{state.date.setDate(state.date.getDate()-1);load()});$('next').addEventListener('click',()=>{state.date.setDate(state.date.getDate()+1);load()});$('refresh').addEventListener('click',load);if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));load();
