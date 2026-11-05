(()=>{
      const state={region:'all',model:'all',source:'all',q:''};
      const valid={region:new Set(['all','west','china']),model:new Set(['all','claude','grok','gemini','glm','qwen','kimi']),source:new Set(['all','lab','research','open-source','social','market'])};
      const params=new URLSearchParams(location.search);
      for(const key of ['region','model','source']) if(valid[key].has(params.get(key))) state[key]=params.get(key);
      state.q=params.get('q')||'';
      const cards=[...document.querySelectorAll('.signal')], input=document.querySelector('#searchInput');
      input.value=state.q;
      const textOf=card=>card.innerText.replace(/\s+/g,' ').trim().toLowerCase();
      const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const escape=value=>String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
      const highlight=(node,q)=>{if(!node.dataset.original)node.dataset.original=node.textContent; const original=node.dataset.original; if(!q){node.textContent=original;return} const normalized=[...original].flatMap((char,index)=>[...normalize(char)].map(()=>index)); const plain=normalize(original), needle=normalize(q); let out='',sourceStart=0,searchStart,pos=plain.indexOf(needle); while(pos>=0){const originalStart=normalized[pos]??sourceStart; const originalEnd=(normalized[pos+needle.length-1]??originalStart)+1; out+=escape(original.slice(sourceStart,originalStart))+'<mark>'+escape(original.slice(originalStart,originalEnd))+'</mark>';sourceStart=originalEnd;searchStart=pos+needle.length;pos=plain.indexOf(needle,searchStart)} node.innerHTML=out+escape(original.slice(sourceStart));};
      function syncUrl(){const next=new URLSearchParams();for(const key of ['region','model','source'])if(state[key]!=='all')next.set(key,state[key]);if(state.q.trim())next.set('q',state.q.trim());const url=location.pathname+(next.toString()?'?'+next.toString():'')+location.hash;history.replaceState({},'',url)}
      function render(){const q=normalize(state.q.trim());let visible=0;cards.forEach(card=>{const matchesRegion=state.region==='all'||card.dataset.region===state.region;const matchesModel=state.model==='all'||card.dataset.models.split(',').includes(state.model);const matchesSource=state.source==='all'||card.dataset.source===state.source;const matchesSearch=!q||normalize(textOf(card)).includes(q);const show=matchesRegion&&matchesModel&&matchesSource&&matchesSearch;card.hidden=!show;if(show)visible++;card.querySelectorAll('h3,.signal-summary,.signal-body p').forEach(node=>highlight(node,state.q.trim()))});document.querySelector('#signalCount').textContent=visible;document.querySelector('#resultsText').textContent=`${visible} ${visible===1?'señal visible':'señales visibles'}`;document.querySelectorAll('.filter-btn').forEach(btn=>btn.classList.toggle('active',state[btn.dataset.filterKey]===btn.dataset.filterValue));syncUrl()}
      document.querySelectorAll('.filter-btn').forEach(btn=>btn.addEventListener('click',()=>{state[btn.dataset.filterKey]=btn.dataset.filterValue;render()}));
      input.addEventListener('input',()=>{state.q=input.value;render()});
      document.querySelector('#resetBtn').addEventListener('click',()=>{state.region='all';state.model='all';state.source='all';state.q='';input.value='';render();input.focus()});
      cards.forEach(card=>{const button=card.querySelector('.signal-header');button.addEventListener('click',()=>{const open=card.classList.toggle('open');button.setAttribute('aria-expanded',String(open))})});
      document.querySelector('#shareBtn').addEventListener('click',async()=>{render();try{await navigator.clipboard.writeText(location.href);document.querySelector('#copyStatus').textContent='Enlace copiado';setTimeout(()=>document.querySelector('#copyStatus').textContent='',2200)}catch{document.querySelector('#copyStatus').textContent='Copia la URL del navegador'}});
      render();
    })();
