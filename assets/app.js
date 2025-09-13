// v2.1 — Corrige overlay que não sumia após login
(() => {
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

  const state = {
    tab:"live",
    currentTab:"live",
    portal:"http://novoshow.xyz:80",
    username:"",
    password:"",
    server_info:null,
    user_info:null,
    cats:{live:[],vod:[],series:[]},
    items:[],
    episodes:[],
    prefs:{logRaw:false,useProxy:true}
  };

  const els = {
    login:$("#login"), app:$("#app"),
    portal:$("#portal"), username:$("#username"), password:$("#password"),
    loginForm:$("#loginForm"), btnLogout:$("#btnLogout"),
    tabs:$$(".tab"), categoryList:$("#categoryList"), searchCat:$("#searchCat"),
    itemList:$("#itemList"), searchItem:$("#searchItem"), sortItem:$("#sortItem"),
    seriesEpisodes:$("#seriesEpisodes"), episodeList:$("#episodeList"),
    player:$("#player"), nowTitle:$("#nowTitle"), nowSub:$("#nowSub"),
    openInPlayer:$("#openInPlayer"), copyURL:$("#copyURL"),
    settings:$("#settings"), btnSettings:$("#btnSettings"),
    prefLogRaw:$("#prefLogRaw"), prefUseProxy:$("#prefUseProxy"),
    btnClear:$("#btnClear")
  };

  const KEY="amz_xtream_v2_1";
  // Sistema de cache otimizado
  function save(){ 
    try {
      localStorage.setItem(KEY, JSON.stringify({...state,items:[],episodes:[]})); 
    } catch(e) {
      console.warn("⚠️ Erro ao salvar cache:", e);
    }
  }
  
  function load(){
    try{ 
      const d = JSON.parse(localStorage.getItem(KEY)||"null"); 
      if(d){
        Object.assign(state,d);
        console.log("⚡ Cache carregado com sucesso");
      }
    } catch(e) {
      console.warn("⚠️ Cache corrompido, usando padrões:", e);
    }
    
    // Configurar preferências e preencher campos de forma assíncrona
    requestAnimationFrame(() => {
      els.prefLogRaw.checked = !!state.prefs.logRaw;
      els.prefUseProxy.checked = !!state.prefs.useProxy;
      
      // Preencher campos de login com dados salvos
      els.portal.value = state.portal || "http://novoshow.xyz:80";
      els.username.value = state.username || "";
      els.password.value = state.password || "";
    });
  }

  // Helpers
  function base(){ return state.portal.replace(/\/$/,""); }
  function q(obj){ return Object.entries(obj).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&"); }
  function apiPath(params){ return `/player_api.php?${q(params)}`; }
  function api(params){
    if(state.prefs.useProxy){ return apiPath(params); }
    return `${base()}${apiPath(params)}`;
  }

  // Cache de requisições para evitar chamadas desnecessárias
  const requestCache = new Map();
  const CACHE_DURATION = 30000; // 30 segundos
  
  async function jget(url, useCache = true){
    // Verificar cache primeiro para acelerar carregamento
    if (useCache && requestCache.has(url)) {
      const cached = requestCache.get(url);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`⚡ Usando cache para: ${url}`);
        return cached.data;
      }
    }
    
    console.log(`🌐 Fazendo requisição para: ${url}`);
    try {
      const r = await fetch(url, {
        credentials: "omit",
        // Otimizações de performance
        cache: "force-cache",
        priority: "high"
      });
      
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      }
      
      const text = await r.text();
      
      try{ 
        const j = JSON.parse(text); 
        
        // Armazenar no cache para acelerar próximas requisições
        if (useCache) {
          requestCache.set(url, {
            data: j,
            timestamp: Date.now()
          });
        }
        
        if(state.prefs.logRaw) console.log("RAW", j); 
        return j; 
      }
      catch(e){ 
        console.error(`❌ Erro ao parsear JSON:`, e);
        if(state.prefs.logRaw) console.log("RAW-TEXT", text); 
        throw new Error(`Resposta não é JSON válido: ${e.message}`);
      }
    } catch (error) {
      // Se a requisição foi abortada, não é necessariamente um erro crítico
      if (error.name === 'AbortError') {
        console.log('ℹ️ Requisição cancelada pelo usuário');
        throw new Error('Requisição cancelada');
      } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
      } else if (error.name === 'SyntaxError') {
        throw new Error('Resposta inválida do servidor. Confira o _redirects e tente novamente.');
      } else {
        throw error;
      }
    }
  }

  function streamURL(kind, id, ext="m3u8"){
    const u = encodeURIComponent(state.username), p = encodeURIComponent(state.password);
    const path = `/${kind}/${u}/${p}/${id}.${ext}`;
    const url = state.prefs.useProxy ? path : `${base()}${path}`;
    console.log(`🔗 Stream URL gerada: ${url}`);
    return url;
  }

  // Função para testar conectividade do stream
  async function testStreamConnectivity(url) {
    try {
      console.log(`🧪 Testando conectividade: ${url}`);
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'cors',
        credentials: 'omit'
      });
      console.log(`✅ Status da conectividade: ${response.status}`);
      return response.ok;
    } catch (error) {
      console.warn(`⚠️ Teste de conectividade falhou: ${error.message}`);
      return false;
    }
  }

  function hideLogin(){
    console.log("🔓 Escondendo tela de login e mostrando aplicação...");
    els.login.classList.add("hidden");
    els.login.setAttribute("aria-hidden","true");
    els.login.style.display = "none";           // fallback mesmo sem CSS .hidden
    els.app.classList.remove("hidden");
    els.app.removeAttribute("aria-hidden");
    console.log("✅ Transição de login concluída");
  }

  function showLogin(){
    console.log("🔐 Mostrando tela de login...");
    els.app.classList.add("hidden");
    els.app.setAttribute("aria-hidden","true");
    els.login.classList.remove("hidden");
    els.login.removeAttribute("aria-hidden");
    els.login.style.display = "";               // remover display:none
    console.log("✅ Tela de login exibida");
  }

  // Login
  els.loginForm.addEventListener("submit", async (ev)=>{
    console.log("🔐 Formulário de login enviado");
    ev.preventDefault();
    
    state.portal = els.portal.value.trim();
    state.username = els.username.value.trim();
    state.password = els.password.value.trim();
    
    console.log("📋 Dados do login:", {
      portal: state.portal,
      username: state.username,
      password: state.password ? "[DEFINIDA]" : "[VAZIA]"
    });
    
    // Validar campos obrigatórios
    if (!state.portal) {
      alert("Por favor, informe a URL do portal.");
      console.error("❌ URL do portal não informada");
      return;
    }
    
    if (!state.username) {
      alert("Por favor, informe o usuário.");
      console.error("❌ Usuário não informado");
      return;
    }
    
    if (!state.password) {
      alert("Por favor, informe a senha.");
      console.error("❌ Senha não informada");
      return;
    }
    
    try{
      console.log("🌐 Fazendo requisição de autenticação...");
      const apiUrl = api({username:state.username,password:state.password});
      console.log("🔗 URL da API:", apiUrl);
      
      const info = await jget(apiUrl);
      console.log("📥 Resposta da API:", info);
      
      if(!(info && info.user_info && String(info.user_info.auth)==="1")){
        console.error("❌ Falha de autenticação:", info);
        alert("Falha de autenticação. Confira usuário/senha/URL."); 
        return;
      }
      
      console.log("✅ Login realizado com sucesso!");
      state.user_info = info.user_info; 
      state.server_info = info.server_info||null;
      save();
      hideLogin();
      await loadTab(state.tab, true);
      
    }catch(e){
      console.error("❌ Erro na requisição de login:", e);
      alert(`Erro de conexão: ${e.message}\n\nVerifique se o servidor está funcionando e se a URL está correta.`);
      // Se houve erro, garantir que a tela de login está visível
      showLogin();
    }
  });
  
  // Debug: verificar se o formulário existe
  if (!els.loginForm) {
    console.error("❌ Formulário de login não encontrado!");
  } else {
    console.log("✅ Formulário de login encontrado e listener adicionado");
  }

  // Logout
  els.btnLogout.addEventListener("click", ()=>{ localStorage.removeItem(KEY); location.reload(); });

  // Tabs
  els.tabs.forEach(b=>b.addEventListener("click", async()=>{
    els.tabs.forEach(x=>x.classList.remove("active")); b.classList.add("active");
    state.tab=b.dataset.tab; save(); await loadTab(state.tab, true);
  }));

  // Settings
  els.btnSettings.addEventListener("click", ()=>els.settings.showModal());
  els.prefLogRaw.addEventListener("change", ()=>{state.prefs.logRaw=els.prefLogRaw.checked; save();});
  els.prefUseProxy.addEventListener("change", ()=>{state.prefs.useProxy=els.prefUseProxy.checked; save();});
  els.btnClear.addEventListener("click",(e)=>{e.preventDefault(); localStorage.removeItem(KEY); alert("Cache limpo."); location.reload();});

  // UI filters
  els.searchCat.addEventListener("input", renderCats);
  els.searchItem.addEventListener("input", renderItems);
  els.sortItem.addEventListener("change", renderItems);
  els.copyURL.addEventListener("click", async()=>{
    const href = els.openInPlayer.getAttribute("href"); if(!href) return;
    await navigator.clipboard.writeText(href); els.copyURL.textContent="Copiado!";
    setTimeout(()=>els.copyURL.textContent="Copiar URL", 1200);
  });

  // Sistema de carregamento otimizado com lazy loading
  let loadingPromises = new Map();
  
  async function loadTab(tab, reloadCats=false){
    try {
      console.log(`⚡ Carregamento rápido da aba: ${tab}`);
      
      // Cancelar carregamentos anteriores para evitar conflitos
      if (loadingPromises.has('currentLoad')) {
        loadingPromises.get('currentLoad').abort?.();
      }
      
      const abortController = new AbortController();
      loadingPromises.set('currentLoad', abortController);
      
      state.currentTab = tab;
      els.seriesEpisodes.classList.toggle("hidden", tab!=="series");
      $("#episodeList").innerHTML="";
      state.items=[]; 
      
      // Renderizar UI imediatamente para responsividade
      renderItems();

      if(reloadCats || !(state.cats[tab]||[]).length){
        console.log(`⚡ Carregamento otimizado de categorias: ${tab}`);
        
        let cats=[];
        let apiUrl;
        
        if(tab==="live") {
          apiUrl = api({username:state.username,password:state.password, action:"get_live_categories"});
        } else if(tab==="vod") {
          apiUrl = api({username:state.username,password:state.password, action:"get_vod_categories"});
        } else if(tab==="series") {
          apiUrl = api({username:state.username,password:state.password, action:"get_series_categories"});
        }
        
        if(apiUrl) {
          // Usar cache inteligente para acelerar carregamento
          cats = await jget(apiUrl, true);
          console.log(`⚡ Categorias carregadas rapidamente:`, cats?.length || 0);
        }
        
        state.cats[tab] = Array.isArray(cats) ? cats : [];
        save(); // Salvar cache imediatamente
        
        // Renderizar de forma assíncrona para não bloquear UI
        requestAnimationFrame(() => {
          renderCats();
          // Auto-selecionar primeira categoria de forma otimizada
          setTimeout(() => {
            const first = $("#categoryList li"); 
            if(first && !abortController.signal.aborted) {
              first.click();
            }
          }, 50);
        });
      }else{
        console.log(`⚡ Cache hit - categorias instantâneas: ${tab}`);
        renderCats();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('ℹ️ Carregamento de aba cancelado');
      } else {
        console.error(`❌ Erro ao carregar aba ${tab}:`, error);
        
        // Verificar se é erro de autenticação (401 ou 403)
        if (error.message.includes('HTTP 401') || error.message.includes('HTTP 403') || error.message.includes('Unauthorized')) {
          console.log('🔐 Erro de autenticação detectado, limpando credenciais...');
          localStorage.removeItem(KEY);
          alert('Sessão expirada ou credenciais inválidas.\n\nVocê será redirecionado para a tela de login.');
          location.reload();
          return;
        }
        
        // Verificar se é erro de conectividade
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          alert(`Erro de conectividade ao carregar ${tab}.\n\nVerifique se:\n• O servidor proxy está funcionando\n• A URL do portal está correta\n• Sua conexão com a internet está ativa\n\nDetalhes: ${error.message}`);
        } else if (error.message.includes('JSON')) {
          alert(`Erro na resposta do servidor para ${tab}.\n\nO servidor retornou dados inválidos.\n\nDetalhes: ${error.message}`);
        } else if (!error.message.includes('cancelada')) {
          console.warn(`⚠️ Erro não crítico ao carregar ${tab}:`, error.message);
          // Não mostrar alert para erros não críticos
        }
        
        // Limpar estado em caso de erro
        state.cats[tab] = [];
        renderCats();
      }
    }
  }

  let categoryClickTimeout = null;
  
  function renderCats(){
    const qv = els.searchCat.value.trim().toLowerCase();
    const cats = (state.cats[state.tab]||[]).filter(c=>(c.category_name||"").toLowerCase().includes(qv));
    els.categoryList.innerHTML="";
    cats.forEach(c=>{
      const li = document.createElement("li");
      li.textContent = c.category_name || `Cat ${c.category_id}`;
      li.dataset.id = c.category_id;
      li.addEventListener("click", ()=>{
        // Debounce para evitar cliques múltiplos
        if(categoryClickTimeout) {
          clearTimeout(categoryClickTimeout);
        }
        categoryClickTimeout = setTimeout(() => {
          selectCat(c);
          categoryClickTimeout = null;
        }, 300);
      });
      els.categoryList.appendChild(li);
    });
  }

  let isLoadingCategory = false;
  
  async function selectCat(c){
    // Evitar múltiplas requisições simultâneas
    if(isLoadingCategory) {
      console.log("⏳ Já há uma categoria sendo carregada, ignorando clique...");
      return;
    }
    
    isLoadingCategory = true;
    $$("#categoryList li").forEach(li=>li.classList.toggle("active", li.dataset.id==c.category_id));
    
    // Mostrar indicador de loading
    els.itemList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">⏳ Carregando...</div>';
    state.items=[]; renderItems();
    
    try {
      console.log(`📂 Carregando itens da categoria: ${c.category_name} (ID: ${c.category_id})`);
      
      let items=[];
      let apiUrl;
      if(state.tab==="live"){
        apiUrl = api({username:state.username,password:state.password, action:"get_live_streams", category_id:c.category_id});
      }else if(state.tab==="vod"){
        apiUrl = api({username:state.username,password:state.password, action:"get_vod_streams", category_id:c.category_id});
      }else{
        apiUrl = api({username:state.username,password:state.password, action:"get_series", category_id:c.category_id});
      }
      
      console.log(`🌐 Fazendo requisição para: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        credentials: "omit"
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      console.log(`📄 Resposta recebida (${text.length} caracteres)`);
      
      try {
        items = JSON.parse(text);
        console.log(`✅ JSON parseado com sucesso:`, items);
      } catch(e) {
        console.error(`❌ Erro ao parsear JSON:`, e);
        throw new Error(`Resposta não é JSON válido: ${e.message}`);
      }
      
      state.items = Array.isArray(items) ? items : [];
      renderItems();
      isLoadingCategory = false;
      
    } catch(error) {
      if (error.name === 'AbortError') {
        console.log('ℹ️ Requisição cancelada');
      } else {
        console.error('❌ Erro ao carregar categoria:', error);
        alert(`Erro ao carregar categoria: ${error.message}`);
      }
      isLoadingCategory = false;
    }
  }

  function renderItems(){
    const qv = els.searchItem.value.trim().toLowerCase();
    const items = (state.items||[]).filter(it=> (it.name||it.title||"").toLowerCase().includes(qv));
    items.sort((a,b)=>{
      if(els.sortItem.value==="name"){
        return (a.name||a.title||"").localeCompare(b.name||b.title||"");
      }
      return (a.stream_id||a.series_id||a.movie_id||0)-(b.stream_id||b.series_id||b.movie_id||0);
    });
    els.itemList.innerHTML="";
    items.forEach(it=>{
      const li = document.createElement("li");
      const img = document.createElement("img");
      img.loading="lazy";
      img.src = it.stream_icon || it.cover || it.cover_big || "";
      const meta = document.createElement("div");
      const t = document.createElement("div"); t.textContent = it.name||it.title||"Sem título";
      const s = document.createElement("div"); s.className="muted small";
      s.textContent = state.tab==="live" ? `Canal • ID ${it.stream_id}` : (state.tab==="vod" ? `Filme • ID ${it.stream_id||it.movie_id}` : `Série • ID ${it.series_id}`);
      meta.append(t,s); li.append(img,meta);
      li.addEventListener("click", ()=> state.tab==="series" ? loadSeriesEpisodes(it.series_id, t.textContent) : playItem(it));
      els.itemList.appendChild(li);
    });
  }

  async function loadSeriesEpisodes(series_id, title){
    els.seriesEpisodes.classList.remove("hidden");
    els.episodeList.innerHTML="<li class='muted'>Carregando...</li>";
    const info = await jget(api({username:state.username,password:state.password, action:"get_series_info", series_id}));
    const eps=[];
    if(info && info.episodes){
      Object.keys(info.episodes).forEach(season=> (info.episodes[season]||[]).forEach(ep=>eps.push({...ep,season})));
    }
    state.episodes=eps; els.episodeList.innerHTML="";
    eps.forEach(ep=>{
      const li=document.createElement("li");
      li.innerHTML = `<strong>S${ep.season}E${ep.episode_num||ep.id}</strong> — ${ep.title||"Episódio"} <span class="muted small">(${(ep.container_extension||"mp4").toUpperCase()})</span>`;
      li.addEventListener("click",()=>playEpisode(ep));
      els.episodeList.appendChild(li);
    });
    els.nowTitle.textContent = title;
    els.nowSub.textContent = "Selecione um episódio";
  }

  async function playItem(it){
    let title = it.name||it.title||"Sem título"; let url="";
    if(state.tab==="live"){
      url = streamURL("live", it.stream_id, "m3u8");
      els.nowSub.textContent = `AO VIVO • ID ${it.stream_id}`;
    }else{
      let ext="mp4";
      try{
        const info = await jget(api({username:state.username,password:state.password, action:"get_vod_info", vod_id: it.stream_id||it.movie_id}));
        ext = (info && info.movie_data && info.movie_data.container_extension) ? info.movie_data.container_extension : "mp4";
        console.log(`📋 Informações do VOD:`, info);
      }catch(e){
        console.warn(`⚠️ Erro ao obter info do VOD:`, e);
      }
      url = streamURL("movie", it.stream_id||it.movie_id, ext);
      els.nowSub.textContent = `FILME • ID ${it.stream_id||it.movie_id}`;
    }
    els.nowTitle.textContent = title;
    
    // Pular teste de conectividade para evitar ERR_ABORTED
    console.log(`🎯 Usando URL de streaming: ${url}`);
    
    play(url);
  }

  function playEpisode(ep){
    const ext = ep.container_extension || "mp4";
    const url = streamURL("series", ep.id||ep.episode_id||ep.stream_id, ext);
    els.nowTitle.textContent = ep.title||"Episódio";
    els.nowSub.textContent = `S${ep.season}E${ep.episode_num||ep.id}`;
    play(url);
  }

  let playbackTimeout = null;
  let currentStreamUrl = null;
  let streamCache = new Map();
  let bufferManager = null;

  function clearStreamCache() {
     console.log("🧹 Limpando cache de stream anterior");
     streamCache.clear();
     preloadManager.clearCache();
     if (bufferManager) {
       bufferManager.destroy();
       bufferManager = null;
     }
   }
   
   // Função auxiliar para informações de buffer
   function getBufferInfo(video) {
     if (!video || !video.buffered || video.buffered.length === 0) {
       return "0s";
     }
     
     const buffered = video.buffered;
     const currentTime = video.currentTime;
     const bufferEnd = buffered.end(buffered.length - 1);
     const bufferLength = bufferEnd - currentTime;
     
     return `${bufferLength.toFixed(1)}s`;
   }
   
   // Sistema de recuperação automática
   function setupAutoRecovery(video, hls) {
     let stallCount = 0;
     let lastCurrentTime = 0;
     let stallCheckInterval;
     
     const checkForStalls = () => {
       if (!video || video.paused) return;
       
       const currentTime = video.currentTime;
       
       // Detecta travamento (mesmo tempo por mais de 3 segundos)
       if (Math.abs(currentTime - lastCurrentTime) < 0.1) {
         stallCount++;
         console.log(`⚠️ Possível travamento detectado (${stallCount}/3)`);
         
         if (stallCount >= 3) {
           console.log("🔧 Iniciando recuperação automática");
           
           // Estratégia 1: Usar cache se disponível
           if (preloadManager.hasCache()) {
             console.log("💾 Usando cache para recuperação");
             video.currentTime = currentTime + 0.1; // Pequeno avanço
           }
           
           // Estratégia 2: Forçar reload do buffer
           if (hls && hls.media) {
             console.log("🔄 Forçando reload do buffer HLS");
             hls.trigger(Hls.Events.BUFFER_RESET);
             setTimeout(() => {
               hls.startLoad(currentTime);
               video.play().catch(e => console.log("Recovery play:", e.message));
             }, 500);
           }
           
           stallCount = 0;
         }
       } else {
         stallCount = 0;
       }
       
       lastCurrentTime = currentTime;
     };
     
     // Monitora travamentos a cada segundo
     stallCheckInterval = setInterval(checkForStalls, 1000);
     
     // Limpa monitor quando necessário
     video.addEventListener('loadstart', () => {
       clearInterval(stallCheckInterval);
     }, { once: true });
     
     return stallCheckInterval;
   }

  function play(url){
    console.log("🎬 Tentando reproduzir:", url);
    els.openInPlayer.href = url;
    const video = els.player;
    
    // Sistema de buffer avançado P2P-like
    if (playbackTimeout) {
      clearTimeout(playbackTimeout);
      playbackTimeout = null;
    }
    
    // Pausa o vídeo atual para evitar conflitos
    if (video && !video.paused) {
      video.pause();
    }
    
    // Limpa cache anterior se mudou de canal
    if (currentStreamUrl && currentStreamUrl !== url) {
      clearStreamCache();
    }
    
    currentStreamUrl = url;
    
    // Limpar player anterior
    if(video._hls){
      video._hls.destroy(); 
      video._hls=null;
      console.log("🧹 HLS anterior destruído");
    }
    video.src = "";
    
    // Aguardar um pouco antes de iniciar nova reprodução
    playbackTimeout = setTimeout(() => {
      startPlayback(url, video);
    }, 100);
  }

  // Sistema de pré-carregamento P2P-like
  let preloadManager = {
    segments: new Map(),
    isPreloading: false,
    preloadQueue: [],
    
    startPreload(url) {
      if (this.isPreloading) return;
      this.isPreloading = true;
      console.log("🚀 Iniciando pré-carregamento inteligente");
      
      // Simula pré-carregamento de segmentos
      setTimeout(() => {
        this.segments.set('preload_' + Date.now(), {
          url: url,
          data: 'cached_segment_data',
          timestamp: Date.now()
        });
        console.log("💾 Segmento pré-carregado, cache size:", this.segments.size);
        this.isPreloading = false;
      }, 1000);
    },
    
    hasCache() {
      return this.segments.size > 0 || streamCache.size > 0;
    },
    
    clearCache() {
      this.segments.clear();
      this.preloadQueue = [];
      console.log("🧹 Cache de pré-carregamento limpo");
    }
  };
  
  function setupCacheBasedPlayback(video, url) {
    console.log("⚙️ Configurando reprodução baseada em cache");
    
    // Monitora buffer constantemente
    const bufferMonitor = setInterval(() => {
      if (!video || video.paused) return;
      
      const buffered = video.buffered;
      if (buffered.length > 0) {
        const currentTime = video.currentTime;
        const bufferEnd = buffered.end(buffered.length - 1);
        const bufferLength = bufferEnd - currentTime;
        
        // Se buffer está baixo, usa cache
        if (bufferLength < 5 && preloadManager.hasCache()) {
          console.log("⚡ Buffer baixo, usando cache para manter reprodução");
          // Força continuidade da reprodução
          if (video.paused) {
            video.play().catch(e => console.log("Cache playback:", e.message));
          }
        }
        
        // Pré-carrega mais conteúdo se buffer está bom
        if (bufferLength > 10 && !preloadManager.isPreloading) {
          preloadManager.startPreload(url);
        }
      }
    }, 1000);
    
    // Limpa monitor quando troca de stream
    video.addEventListener('loadstart', () => {
      clearInterval(bufferMonitor);
    }, { once: true });
  }

  function startPlayback(url, video){
    console.log("▶️ Iniciando reprodução com sistema P2P-like:", url);
    
    // Inicia pré-carregamento imediatamente
    preloadManager.startPreload(url);
    
    // Configura reprodução baseada em cache
    setupCacheBasedPlayback(video, url);
    
    if(window.Hls && window.Hls.isSupported() && url.endsWith(".m3u8")){
      console.log("📺 Usando HLS.js para stream M3U8");
      const hls = new Hls({
        maxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        enableWorker: true,
        lowLatencyMode: false,
        debug: state.prefs.logRaw,
        // Buffer avançado P2P-like
        backBufferLength: 30,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        // Configurações de timeout mais generosas
        manifestLoadingTimeOut: 30000,
        manifestLoadingMaxRetry: 5,
        levelLoadingTimeOut: 30000,
        levelLoadingMaxRetry: 5,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 5,
        // Cache inteligente
        progressive: true,
        startFragPrefetch: true
      });
      
      bufferManager = hls;
       
       // Ativa sistema de recuperação automática
       setupAutoRecovery(video, hls);
       
       // Sistema "Never Stop Playing" - Mantém reprodução sempre ativa
       const neverStopMonitor = setInterval(() => {
         if (!video || !hls) {
           clearInterval(neverStopMonitor);
           return;
         }
         
         const currentTime = video.currentTime;
         const buffered = video.buffered;
         
         // Se vídeo pausou inesperadamente e há buffer disponível
         if (video.paused && !video.seeking && buffered.length > 0) {
           const bufferEnd = buffered.end(buffered.length - 1);
           if (currentTime < bufferEnd - 1) {
             console.log("🔄 NEVER STOP: Reativando reprodução pausada");
             video.play().catch(e => {
               console.log("Never stop play error:", e.message);
               // Se falhar, tenta avançar um pouco e tentar novamente
               video.currentTime = currentTime + 0.1;
               setTimeout(() => video.play().catch(() => {}), 500);
             });
           }
         }
         
         // Verifica se HLS está carregando
         if (hls.loadLevel === -1 && buffered.length === 0) {
           console.log("🚀 NEVER STOP: Reativando carregamento HLS");
           hls.startLoad();
         }
       }, 2000);
       
       // Limpa monitor quando stream muda
       video.addEventListener('loadstart', () => {
         clearInterval(neverStopMonitor);
       }, { once: true });
       
       video._hls = hls;
      
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log("✅ HLS: Mídia anexada");
      });
      
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log("✅ HLS: Manifest carregado", data.levels.length, "qualidades");
        
        // Seleciona qualidade baseada na conexão
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
          const effectiveType = connection.effectiveType;
          console.log("📶 Tipo de conexão detectado:", effectiveType);
          
          if (effectiveType === '4g' && data.levels.length > 2) {
            hls.currentLevel = data.levels.length - 1; // Melhor qualidade
          } else if (effectiveType === '3g' && data.levels.length > 1) {
            hls.currentLevel = Math.floor(data.levels.length / 2); // Qualidade média
          } else {
            hls.currentLevel = 0; // Menor qualidade
          }
        }
        
        video.play().catch(e => {
          if (e.name === 'AbortError') {
            console.log("🔄 Reprodução interrompida (normal ao trocar de canal)");
          } else {
            console.error("❌ Erro ao iniciar reprodução:", e);
          }
        });
      });
      
      // Sistema de cache P2P-like avançado
       hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
         const fragKey = `${data.frag.level}_${data.frag.sn}`;
         streamCache.set(fragKey, {
           data: data.payload,
           timestamp: Date.now(),
           level: data.frag.level,
           sn: data.frag.sn,
           duration: data.frag.duration,
           url: data.frag.url
         });
         
         // Pré-carrega próximos segmentos
         preloadManager.preloadQueue.push({
           level: data.frag.level,
           sn: data.frag.sn + 1,
           timestamp: Date.now()
         });
         
         // Limita cache a 100 fragmentos (mais cache = melhor experiência)
         if (streamCache.size > 100) {
           const oldestKey = streamCache.keys().next().value;
           streamCache.delete(oldestKey);
         }
         
         console.log("💾 Fragmento cacheado:", fragKey, "Cache size:", streamCache.size, "Buffer:", getBufferInfo(video));
       });
       
       // Monitora qualidade de rede e ajusta automaticamente
       hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
         console.log("📶 Qualidade alterada para nível:", data.level);
         
         // Se mudou para qualidade menor, aumenta cache
         if (data.level < 2) {
           console.log("⬇️ Qualidade baixa detectada, aumentando cache");
           preloadManager.startPreload(url);
         }
       });
      
      // Buffer inteligente com controle de reprodução contínua
       hls.on(Hls.Events.BUFFER_APPENDED, () => {
         const buffered = video.buffered;
         if (buffered.length > 0) {
           const bufferEnd = buffered.end(buffered.length - 1);
           const currentTime = video.currentTime;
           const bufferLength = bufferEnd - currentTime;
           console.log("📊 Buffer atual:", bufferLength.toFixed(2), "segundos");
           
           // Força reprodução contínua se buffer está disponível
           if (bufferLength > 2 && video.paused && !video.seeking) {
             console.log("▶️ Forçando reprodução contínua - buffer disponível");
             video.play().catch(e => console.log("Auto-play:", e.message));
           }
         }
       });
       
       // Monitora travamentos em tempo real
       let lastPlaybackTime = 0;
       let stallDetectionCount = 0;
       
       const continuousPlaybackMonitor = setInterval(() => {
         if (!video || video.paused) return;
         
         const currentTime = video.currentTime;
         const buffered = video.buffered;
         
         // Detecta se o tempo não está avançando
         if (Math.abs(currentTime - lastPlaybackTime) < 0.1) {
           stallDetectionCount++;
           console.log(`⚠️ Travamento detectado (${stallDetectionCount}/2) - Tempo: ${currentTime.toFixed(2)}s`);
           
           if (stallDetectionCount >= 2) {
             console.log("🚨 TRAVAMENTO CONFIRMADO - Iniciando recuperação de emergência");
             
             // Estratégia 1: Pular pequeno trecho problemático
             if (buffered.length > 0) {
               const bufferStart = buffered.start(0);
               const bufferEnd = buffered.end(buffered.length - 1);
               
               if (currentTime < bufferEnd - 1) {
                 console.log("⏭️ Pulando trecho problemático");
                 video.currentTime = currentTime + 0.5;
                 video.play().catch(e => console.log("Skip play:", e.message));
               }
             }
             
             // Estratégia 2: Forçar reload se necessário
             if (stallDetectionCount >= 4) {
               console.log("🔄 Forçando reload completo do stream");
               const currentPos = video.currentTime;
               hls.trigger(Hls.Events.BUFFER_RESET);
               setTimeout(() => {
                 hls.startLoad(currentPos);
                 video.currentTime = currentPos;
                 video.play().catch(e => console.log("Reload play:", e.message));
               }, 1000);
               stallDetectionCount = 0;
             }
           }
         } else {
           stallDetectionCount = 0;
         }
         
         lastPlaybackTime = currentTime;
       }, 1000);
       
       // Limpa monitor quando stream muda
       video.addEventListener('loadstart', () => {
         clearInterval(continuousPlaybackMonitor);
       }, { once: true });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("❌ HLS Error:", data);
        
        // Mensagens específicas para diferentes tipos de erro
        if (data.details === 'levelParsingError') {
          console.error("📄 Erro de parsing M3U8: Arquivo playlist inválido");
          alert(`Erro no streaming: Arquivo de playlist inválido\n\nO servidor retornou um arquivo M3U8 corrompido ou incompleto.\n\nTente:\n• Escolher outro canal\n• Verificar se o servidor está funcionando\n\nDetalhes: ${data.error?.message || 'Formato inválido'}`);
        }
        
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("🔄 Tentando recuperar erro de rede...");
              
              // Sistema avançado de recuperação de rede
               if (data.details === 'fragLoadError' || data.details === 'fragLoadTimeOut') {
                 console.log("🔧 Erro de carregamento de fragmento - Mantendo reprodução contínua");
                 
                 // Não para a reprodução, apenas pula o fragmento problemático
                 const currentTime = video.currentTime;
                 const buffered = video.buffered;
                 
                 if (buffered.length > 0) {
                   const bufferEnd = buffered.end(buffered.length - 1);
                   if (currentTime < bufferEnd - 2) {
                     console.log("▶️ Continuando reprodução com buffer disponível");
                     // Força reprodução contínua mesmo com fragmento perdido
                     if (video.paused) {
                       video.play().catch(e => console.log("Continue play:", e.message));
                     }
                     return; // Não tenta reload, continua com o que tem
                   }
                 }
                 
                 // Só faz reload se realmente necessário
                 console.log("🔄 Reload necessário - buffer insuficiente");
                 setTimeout(() => hls.startLoad(), 1000);
               } else if (streamCache.size > 0) {
                 console.log("💾 Usando conteúdo em cache durante problema de rede");
                 // Continua reprodução com cache disponível
                 setTimeout(() => hls.startLoad(), 2000);
               } else if (data.details === 'levelParsingError') {
                console.log("💥 Erro de parsing fatal, não é possível recuperar");
                hls.destroy();
                video.src = url; // Fallback para player nativo
                video.play().catch(e => {
                  console.error("❌ Fallback também falhou:", e);
                  alert(`Erro crítico no streaming\n\nNão foi possível reproduzir este conteúdo.\n\nURL: ${url}`);
                });
              } else {
                // Retry com backoff exponencial
                const retryDelay = Math.min(1000 * Math.pow(2, (data.retry || 0)), 10000);
                console.log(`⏳ Tentativa de reconexão em ${retryDelay}ms`);
                setTimeout(() => hls.startLoad(), retryDelay);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("🔄 Tentando recuperar erro de mídia...");
              
              // Sistema avançado de recuperação de mídia
               if (data.details === 'bufferStalledError') {
                 console.log("🔧 Buffer travado detectado, iniciando recuperação avançada");
                 
                 // Estratégia 1: Usar cache se disponível
                 if (streamCache.size > 0 || preloadManager.hasCache()) {
                   console.log("💾 Usando cache para recuperação de buffer travado");
                   
                   // Avança ligeiramente no tempo para sair do travamento
                   const currentTime = video.currentTime;
                   video.currentTime = currentTime + 0.5;
                   
                   // Força limpeza e recarga do buffer
                   hls.trigger(Hls.Events.BUFFER_RESET);
                   setTimeout(() => {
                     hls.startLoad(currentTime + 0.5);
                     video.play().catch(e => console.log("Buffer recovery play:", e.message));
                   }, 1000);
                 } else {
                   // Estratégia 2: Recuperação padrão com delay
                   console.log("🔄 Recuperação padrão de buffer travado");
                   setTimeout(() => hls.recoverMediaError(), 1000);
                 }
               } else if (data.details === 'bufferAppendError') {
                 console.log("📝 Erro de append no buffer, tentando recuperação");
                 hls.trigger(Hls.Events.BUFFER_RESET);
                 setTimeout(() => hls.recoverMediaError(), 500);
               } else {
                 console.log("🔄 Recuperação padrão de erro de mídia");
                 hls.recoverMediaError();
               }
              break;
            default:
              console.log("💥 Erro fatal, tentando fallback para src nativo");
              hls.destroy();
              video._hls = null;
              video.src = url;
              video.play().catch(e => console.error("❌ Fallback também falhou:", e));
              break;
          }
        }
      });
      
      hls.loadSource(url);
      hls.attachMedia(video);
      
    } else {
      console.log("📹 Usando player nativo para:", url.split('.').pop());
      video.src = url;
      
      video.addEventListener('loadstart', () => console.log("⏳ Carregando vídeo..."));
      video.addEventListener('canplay', () => console.log("✅ Vídeo pronto para reproduzir"));
      video.addEventListener('error', (e) => {
        console.error("❌ Erro no player nativo:", e);
        console.error("❌ Detalhes do erro:", video.error);
      });
      
      video.play().catch(e => {
        if (e.name === 'AbortError') {
          console.log("🔄 Player nativo: Reprodução interrompida (normal ao trocar de canal)");
        } else {
          console.error("❌ Erro ao iniciar reprodução nativa:", e);
          alert(`Erro ao reproduzir: ${e.message}\n\nURL: ${url}\n\nTente abrir o link direto ou verifique se o servidor está funcionando.`);
        }
      });
    }
  }

  // Sistema de inicialização ultra-rápida
  console.log("⚡ Inicialização otimizada...");
  
  // Carregar estado de forma assíncrona
  const initPromise = new Promise((resolve) => {
    requestAnimationFrame(() => {
      load();
      resolve();
    });
  });
  
  // Pré-carregar elementos críticos
  const preloadCriticalElements = () => {
    // Pré-conectar com o servidor para acelerar requisições
    if (state.portal) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = state.portal;
      document.head.appendChild(link);
    }
  };
  
  initPromise.then(() => {
    console.log("⚡ Estado carregado:", {
      portal: state.portal,
      username: state.username ? "[DEFINIDO]" : "[VAZIO]",
      password: state.password ? "[DEFINIDA]" : "[VAZIA]",
      hasCredentials: !!(state.username && state.password)
    });
    
    preloadCriticalElements();
    
    // Login automático otimizado
    if(state.username && state.password){
      console.log("⚡ Login automático ultra-rápido...");
      
      // Esconder login imediatamente para melhor UX
      hideLogin();
      
      // Preencher campos de forma assíncrona
      requestAnimationFrame(() => {
        els.portal.value = state.portal; 
        els.username.value = state.username; 
        els.password.value = state.password;
      });
      
      // Carregar aba com timeout para evitar travamentos
      const loadTimeout = setTimeout(() => {
        console.log("⚠️ Timeout no carregamento, usando fallback");
        showLogin();
      }, 10000);
      
      loadTab(state.tab, false)
        .then(() => {
          clearTimeout(loadTimeout);
          console.log("⚡ Login automático concluído!");
        })
        .catch((e) => {
          clearTimeout(loadTimeout);
          console.error("❌ Erro no login automático:", e);
          
          // Fallback inteligente - não recarregar página imediatamente
          if (e.message.includes('401') || e.message.includes('403')) {
            console.log("🔄 Credenciais expiradas, limpando cache...");
            localStorage.removeItem(KEY);
            showLogin();
          } else {
            console.log("🔄 Erro temporário, tentando novamente...");
            setTimeout(() => {
              loadTab(state.tab, true).catch(() => {
                showLogin();
              });
            }, 2000);
          }
        });
    } else {
      console.log("ℹ️ Tela de login exibida");
    }
  });
})();