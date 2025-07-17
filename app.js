let carrerasData = {};

function nivelAColumna(nivel) {
  const mapa = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8, IX:9, X:10 };
  return mapa[nivel] || 1;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines.shift().split(';').map(h=>h.trim());
  return lines.map(l => {
    const cols = l.split(';').map(c=>c.trim());
    return headers.reduce((o,h,i)=>{ o[h]=cols[i]||''; return o; }, {});
  });
}

async function loadCarreras() {
  const text = await fetch('medvet_malla.csv').then(r=>r.text());
  const rows = parseCSV(text);

  const integrativa     = [1,16,36,43,45,51,54,55,56,58,60];
  const formBas         = [2,3,4,5,6,9,10,11,17,18,24,30,49];
  const electiva        = [12,19,25,31,37];
  const salAnimal       = [7,13,15,20,21,22,28,32,33,34,39,40,41,42,44,46,47,48,52,53];
  const prodAnimal      = [8,14,26,38];
  const medioAmb        = [23,29];
  const salPublica      = [27,35,50,57];
  const transversal     = rows
    .map(r=>parseInt(r['Código Asignatura'],10))
    .filter(n=>![...integrativa,...formBas,...electiva,
                 ...salAnimal,...prodAnimal,...medioAmb,...salPublica].includes(n));

  const asigs = rows.map(r=>{
    let codigo = r['Código Asignatura'];
    if(codigo.includes('.')) codigo = codigo.split('.')[0];
    const num = parseInt(codigo,10);
    const prereqs = ['Prerrequisito 01 (Código)','Prerrequisito 02 (Código)','Prerrequisito 03 (Código)']
      .map(c=>r[c]).filter(v=>v&&v.toLowerCase()!=='ingreso')
      .map(v=>v.includes('.')? v.split('.')[0]: v);

    let area='';
    if(integrativa.includes(num))      area='integrativa';
    else if(formBas.includes(num))     area='formacion-basica';
    else if(electiva.includes(num))    area='electiva';
    else if(salAnimal.includes(num))   area='salud-animal';
    else if(prodAnimal.includes(num))  area='produccion-animal';
    else if(medioAmb.includes(num))    area='medio-ambiente';
    else if(salPublica.includes(num))  area='salud-publica';
    else if(transversal.includes(num)) area='transversal';

    return { codigo, nombre: r['Asignatura'], nivel: r['Nivel'], prerrequisitos: prereqs, area };
  });

  carrerasData['MEDVET'] = asigs;
  renderCarreraOptions();
}

function renderCarreraOptions() {
  const sel = document.getElementById('carrera-select');
  const o = document.createElement('option');
  o.value='MEDVET'; o.textContent='Medicina Veterinaria';
  sel.appendChild(o);
  sel.addEventListener('change', e=>{
    document.getElementById('info-below').style.display = 'block';
    renderMalla(carrerasData[e.target.value]);
  });
}

function renderMalla(asigs) {
  const grid = document.querySelector('.malla-grid');
  grid.innerHTML = '';

  const areaMap = {};
  asigs.forEach(a => areaMap[a.codigo] = a.area);

  asigs.forEach(a => {
    const div = document.createElement('div');
    div.className  = 'grid-item' + (a.area ? ' area-' + a.area : '');
    div.style.gridColumn = nivelAColumna(a.nivel);
    div.dataset.codigo   = a.codigo;
    div.dataset.prereqs  = JSON.stringify(a.prerrequisitos);

    // top-bar
    const top = document.createElement('div');
    top.className = 'top-bar';
    div.appendChild(top);
    const code = document.createElement('span');
    code.className = 'code-label';
    code.textContent = a.codigo;
    top.appendChild(code);

    // name
    const nm = document.createElement('div');
    nm.className = 'course-name';
    nm.textContent = a.nombre;
    div.appendChild(nm);

    // bottom-bar
    const bot = document.createElement('div');
    bot.className = 'bottom-bar';
    div.appendChild(bot);

    a.prerrequisitos.forEach((pr,i) => {
      const p = document.createElement('span');
      p.className = 'prereq-label';
      p.textContent = pr;
      p.style.left = `${4 + i*22}px`;
      const ar = areaMap[pr];
      if(ar) p.classList.add('area-' + ar);
      bot.appendChild(p);
    });

    grid.appendChild(div);
  });

  loadState();
  actualizarDependencias();
  updatePercentage();
}

document.addEventListener('click', e=>{
  const it = e.target.closest('.grid-item');
  if(!it) return;
  it.classList.toggle('aprobado');
  actualizarDependencias();
  saveState();
});

function actualizarDependencias() {
  const nivelMap = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8, IX:9, X:10 };
  document.querySelectorAll('.grid-item').forEach(el=>{
    const codigo = el.dataset.codigo;
    let ok;
    if(codigo==='56') {
      ok = Array.from(document.querySelectorAll('.grid-item'))
        .filter(item=>{
          const a = carrerasData['MEDVET']
            .find(x=>x.codigo===item.dataset.codigo);
          return a && nivelMap[a.nivel] <= 4;
        })
        .every(item=>item.classList.contains('aprobado'));
    } else {
      const prereqs = JSON.parse(el.dataset.prereqs);
      ok = prereqs.every(code=>{
        const pre = document.querySelector(`.grid-item[data-codigo="${code}"]`);
        return pre && pre.classList.contains('aprobado');
      });
    }
    if(!ok) {
      el.classList.add('bloqueado');
      el.classList.remove('aprobado');
    } else {
      el.classList.remove('bloqueado');
    }
  });
  updatePercentage();
}

function saveState(){
  const aprob = Array.from(document.querySelectorAll('.grid-item.aprobado'))
    .map(el=>el.dataset.codigo);
  localStorage.setItem('mallaAprobados', JSON.stringify(aprob));
}

function loadState(){
  const almacen = JSON.parse(localStorage.getItem('mallaAprobados') || '[]');
  almacen.forEach(c=>{
    const el = document.querySelector(`.grid-item[data-codigo="${c}"]`);
    if(el) el.classList.add('aprobado');
  });
}

function updatePercentage() {
  const total = document.querySelectorAll('.grid-item').length;
  const aprob  = document.querySelectorAll('.grid-item.aprobado').length;
  const pct    = total ? Math.round((aprob/total)*100) : 0;
  document.getElementById('percentage').textContent = `Total de ramos: ${pct}%`;
}

document.addEventListener('DOMContentLoaded', loadCarreras);
