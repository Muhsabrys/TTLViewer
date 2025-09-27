// Simple TTL parser (very small subset): supports triples lines and prefixes
(function(){
  const fileInput = document.getElementById('fileInput')
  const statusEl = document.getElementById('status')
  const triplesContainer = document.getElementById('triplesContainer')
  const tabs = document.querySelectorAll('.tabs button')
  const tabContents = document.querySelectorAll('.tab-content')
  const queryBox = document.getElementById('queryBox')
  const executeBtn = document.getElementById('executeQuery')
  const queryResults = document.getElementById('queryResults')
  const presetButtons = document.querySelectorAll('[data-sample]')
  const sparqlHelp = document.getElementById('sparqlHelp')
  const toggleHelp = document.getElementById('toggleHelp')
  const downloadCsv = document.getElementById('downloadCsv')
  const downloadJson = document.getElementById('downloadJson')
  const showLabels = document.getElementById('showLabels')
  const nodeCount = document.getElementById('nodeCount')

  let triples = [] // {s,p,o}
  let prefixes = {}

  // Tabs
  tabs.forEach(b=>b.addEventListener('click', ()=>{
    tabs.forEach(x=>x.classList.remove('active'))
    b.classList.add('active')
    const key = b.dataset.tab
    tabContents.forEach(tc=>tc.classList.remove('active'))
    document.getElementById(key).classList.add('active')
    if(key==='viz') renderGraph()
  }))

  // File load
  fileInput.addEventListener('change', e=>{
    const f = e.target.files[0]
    if(!f) return
    statusEl.textContent = `Loading ${f.name}...`
    const reader = new FileReader()
    reader.onload = ()=>{
      const text = reader.result
      parseTTL(text)
      statusEl.textContent = `${f.name} — ${triples.length} triples parsed`
      document.getElementById('welcome').style.display='none'
      document.querySelector('[data-tab="triples"]').click()
    }
    reader.readAsText(f)
  })

  // Very small Turtle parser: handles prefixes and simple triple lines
  function parseTTL(text){
    triples = []
    prefixes = {}
    const lines = text.split(/\r?\n/)
    for(let raw of lines){
      let line = raw.trim()
      if(!line || line.startsWith('#')) continue
      // prefix
      const p = line.match(/^@prefix\s+([^:]+):\s+<([^>]+)>\s*\./i)
      if(p){ prefixes[p[1]] = p[2]; continue }
      // simple triple pattern: subj pred obj .
      const m = line.match(/^(<[^>]+>|[^\s]+)\s+(<[^>]+>|[^\s]+)\s+("[^"]*"(?:\^\^[^\s]+)?|<[^>]+>|[^\s]+)\s*\.?$/)
      if(m){
        let s = expandTerm(m[1])
        let pterm = expandTerm(m[2])
        let o = expandTerm(m[3])
        triples.push({s, p: pterm, o})
        if(triples.length>800){ break }
      }
    }
    renderTriples()
  }

  function expandTerm(t){
    t = t.trim()
    if(t.startsWith('<') && t.endsWith('>')) return t.slice(1,-1)
    if(t.startsWith('"')) return t // keep literal
    const m = t.match(/^([^:]+):(.+)$/)
    if(m && prefixes[m[1]]) return prefixes[m[1]] + m[2]
    return t
  }

  function renderTriples(){
    triplesContainer.innerHTML = ''
    for(const t of triples){
      const div = document.createElement('div')
      div.className='triple'
      const s = document.createElement('div'); s.className='s'; s.textContent = t.s
      const p = document.createElement('div'); p.className='p'; p.textContent = t.p
      const o = document.createElement('div'); o.className='o'; o.textContent = t.o
      div.appendChild(s); div.appendChild(p); div.appendChild(o)
      triplesContainer.appendChild(div)
    }
  }

  // Preset buttons
  presetButtons.forEach(b=>b.addEventListener('click', ()=>{
    const v = b.dataset.sample
    if(v==='ALL_TRIPLES') queryBox.value = 'SELECT * WHERE { ?s ?p ?o }'
    if(v==='ALL_SUBJECTS') queryBox.value = 'SELECT DISTINCT ?s WHERE { ?s ?p ?o }'
    if(v==='ALL_PREDICATES') queryBox.value = 'SELECT DISTINCT ?p WHERE { ?s ?p ?o }'
    if(v==='ALL_OBJECTS') queryBox.value = 'SELECT DISTINCT ?o WHERE { ?s ?p ?o }'
  }))

  toggleHelp.addEventListener('click', ()=>{ sparqlHelp.hidden = !sparqlHelp.hidden })

  // Basic query executor: parse a tiny subset
  function executeQuery(){
    const q = queryBox.value.trim()
    // support: SELECT * WHERE { ?s ?p ?o } [FILTER CONTAINS(?o,"str")] [LIMIT n] [OFFSET n]
    const out = []
    const lc = q.toUpperCase()
    let results = triples.slice()
    // FILTER CONTAINS
    const filt = q.match(/FILTER\s+CONTAINS\(\?([spo]),\s*"([^"]+)"\)/i)
    if(filt){ const varn=filt[1]; const str=filt[2]; results = results.filter(r=>String(r[varName(varn)]).includes(str)) }
    // concrete subject/predicate/object in WHERE
    const whereMatch = q.match(/WHERE\s*\{\s*([^\}]+)\s*\}/i)
    if(whereMatch){
      const pattern = whereMatch[1].trim()
      const parts = pattern.split(/\s+/)
      if(parts.length>=3){
        ['s','p','o'].forEach((v,i)=>{
          const term = parts[i]
          if(term && !term.startsWith('?')){
            const expanded = term.startsWith('<')? term.slice(1,-1) : term
            results = results.filter(r => r[['s','p','o'][i]] === expanded)
          }
        })
      }
    }
    // DISTINCT projection
    const selectDistinct = /SELECT\s+DISTINCT\s+\?([spo])/i.exec(q)
    const selectAll = /SELECT\s+\*/i.exec(q)
    // LIMIT/OFFSET
    const limitMatch = /LIMIT\s+(\d+)/i.exec(q)
    const offsetMatch = /OFFSET\s+(\d+)/i.exec(q)
    let offset = offsetMatch? parseInt(offsetMatch[1],10):0
    let limit = limitMatch? parseInt(limitMatch[1],10): results.length
    results = results.slice(offset, offset+limit)

    if(selectDistinct){
      const v = varName(selectDistinct[1])
      const uniq = [...new Map(results.map(r=>[r[v],r[v]])).values()]
      // render as single column
      renderTable(uniq.map(x=>({val:x})), ['Value'])
      return
    }

    if(selectAll){
      renderTable(results, ['s','p','o'])
      return
    }

    // fallback: try select ?s ?p ?o
    renderTable(results, ['s','p','o'])
  }

  function varName(ch){ return ch==='s'?'s': ch==='p'?'p':'o' }

  function renderTable(rows, cols){
    queryResults.innerHTML = ''
    const table = document.createElement('table')
    table.style.width='100%'
    table.style.borderCollapse='collapse'
    const thead = document.createElement('thead')
    const trh = document.createElement('tr')
    cols.forEach(c=>{ const th = document.createElement('th'); th.textContent = c; th.style.textAlign='left'; th.style.padding='6px'; trh.appendChild(th) })
    thead.appendChild(trh)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    rows.forEach(r=>{
      const tr = document.createElement('tr')
      cols.forEach(c=>{
        const td = document.createElement('td')
        td.textContent = r[c] || r['val'] || ''
        td.style.padding='6px'
        td.style.borderTop='1px solid rgba(255,255,255,0.03)'
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    queryResults.appendChild(table)
  }

  executeBtn.addEventListener('click', executeQuery)

  // Exports
  downloadCsv.addEventListener('click', ()=>{
    const table = queryResults.querySelector('table')
    if(!table){ alert('No results to export'); return }
    const rows = Array.from(table.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('th,td')).map(td=>td.textContent))
    const csv = rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n')
    downloadBlob(csv,'results.csv','text/csv')
  })
  downloadJson.addEventListener('click', ()=>{
    const table = queryResults.querySelector('table')
    if(!table){ alert('No results to export'); return }
    const headers = Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent)
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr=>{
      const cells = Array.from(tr.querySelectorAll('td'))
      const obj = {}
      cells.forEach((td,i)=> obj[headers[i]] = td.textContent)
      return obj
    })
    downloadBlob(JSON.stringify(rows,null,2),'results.json','application/json')
  })

  function downloadBlob(content, name, type){
    const blob = new Blob([content], {type})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  // Visualization via D3
  function renderGraph(){
    const area = document.getElementById('vizArea')
    area.innerHTML = ''
    if(!triples.length){ area.innerHTML = '<div style="padding:12px;color:var(--muted)">No data loaded</div>'; return }
    // build nodes and links
    const nodesMap = new Map()
    const links = []
    triples.forEach(t=>{
      if(!nodesMap.has(t.s)) nodesMap.set(t.s, {id:t.s, type:'subject'})
      if(!nodesMap.has(t.o)) nodesMap.set(t.o, {id:t.o, type:'object'})
      links.push({source:t.s, target:t.o, label:t.p})
    })
    const nodes = Array.from(nodesMap.values())
    nodeCount.textContent = `${nodes.length} nodes • ${links.length} links`

    const width = area.clientWidth || 800
    const height = area.clientHeight || 520

    const svg = d3.select(area).append('svg').attr('width', '100%').attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g')

    const link = g.selectAll('.link').data(links).enter().append('line')
      .attr('stroke', 'rgba(255,255,255,0.08)').attr('stroke-width',1)

    const linkLabel = g.selectAll('.linkLabel').data(links).enter().append('text')
      .text(d=>d.label).attr('font-size',10).attr('fill','rgba(255,255,255,0.7)')

    const node = g.selectAll('.node').data(nodes).enter().append('g').attr('class','node').call(d3.drag()
      .on('start', dragstarted).on('drag', dragged).on('end', dragended))

    node.append('circle').attr('r', d=> d.type==='subject'?8:6).attr('fill', d=> d.type==='subject'? '#3b82f6' : '#10b981')
    node.append('title').text(d=>d.id)
    node.append('text').text(d=>shortLabel(d.id)).attr('x',12).attr('y',4).attr('font-size',10).attr('fill','rgba(255,255,255,0.8)')

    const simulation = d3.forceSimulation(nodes).force('link', d3.forceLink(links).id(d=>d.id).distance(120)).force('charge', d3.forceManyBody().strength(-300)).force('center', d3.forceCenter(width/2, height/2))

    simulation.on('tick', ()=>{
      link.attr('x1', d=>d.source.x).attr('y1', d=>d.source.y).attr('x2', d=>d.target.x).attr('y2', d=>d.target.y)
      node.attr('transform', d=>`translate(${d.x},${d.y})`)
      linkLabel.attr('x', d=> (d.source.x + d.target.x)/2 ).attr('y', d=> (d.source.y + d.target.y)/2 )
    })

    // zoom
    svg.call(d3.zoom().on('zoom', (event)=>{ g.attr('transform', event.transform) }))

    // helpers
    function shortLabel(uri){ if(uri.length>36) return uri.slice(0,30)+'...'; return uri }
    function dragstarted(event,d){ if(!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y }
    function dragged(event,d){ d.fx = event.x; d.fy = event.y }
    function dragended(event,d){ if(!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null }

    // click highlight
    node.on('click', (event,d)=>{
      const neighbors = new Set()
      links.forEach(l=>{ if(l.source.id===d.id) neighbors.add(l.target.id); if(l.target.id===d.id) neighbors.add(l.source.id) })
      node.selectAll('circle').attr('opacity', n=> (n.id===d.id || neighbors.has(n.id))?1:0.15)
      link.attr('opacity', l=> (l.source.id===d.id || l.target.id===d.id)?1:0.08)
    })

    // toggle labels
    showLabels.addEventListener('change', ()=>{ linkLabel.style('display', showLabels.checked? 'block' : 'none') })
    linkLabel.style('display', showLabels.checked? 'block' : 'none')
  }

  // init
  document.querySelector('[data-tab="triples"]').click()
})();
