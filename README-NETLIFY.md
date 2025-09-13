# 🎥 IPTV Player - Deploy no Netlify

## 📦 Conteúdo do Projeto

Este ZIP contém uma aplicação IPTV completa pronta para deploy no Netlify:

### 📁 Arquivos Principais
- `index.html` - Página principal da aplicação
- `assets/app.js` - JavaScript principal com player HLS
- `assets/styles.css` - Estilos da aplicação
- `_redirects` - Configuração de proxy para Netlify
- `netlify.toml` - Configuração do Netlify

### 🧪 Páginas de Teste
- `debug.html` - Página de debug avançada
- `test-hls.html` - Teste específico para streaming HLS
- `test.html` - Página de teste básica

### 🚀 Como Fazer Deploy no Netlify

1. **Acesse o Netlify**: Vá para [netlify.com](https://netlify.com)
2. **Faça Login**: Entre com sua conta ou crie uma nova
3. **Deploy Manual**:
   - Clique em "Add new site" → "Deploy manually"
   - Arraste o arquivo `netlify-deploy.zip` para a área de upload
   - Aguarde o deploy ser concluído

4. **Configuração Automática**:
   - O arquivo `netlify.toml` já está configurado
   - Os redirects em `_redirects` serão aplicados automaticamente
   - CORS e headers de segurança já estão configurados

### ⚙️ Configurações Incluídas

#### Redirects (_redirects)
```
# API endpoints
/player_api.php http://novoshow.xyz:80/player_api.php 200

# Stream endpoints with CORS headers
/live/*   http://novoshow.xyz:80/live:splat 200!
/movie/*  http://novoshow.xyz:80/movie:splat 200!
/series/* http://novoshow.xyz:80/series:splat 200!
/hls/*    http://novoshow.xyz:80/hls:splat 200!

# Fallback for other formats
/get.php* http://novoshow.xyz:80/get.php:splat 200!
/streaming/* http://novoshow.xyz:80/streaming/:splat 200!
```

#### Headers de Segurança (netlify.toml)
- CORS configurado para streaming
- Headers de segurança CSP
- Cache otimizado para diferentes tipos de arquivo

### 🎯 Funcionalidades

✅ **Player IPTV Completo**
- Suporte a streaming HLS
- Interface responsiva e moderna
- Categorização de canais (TV, Filmes, Séries)
- Sistema de login com credenciais

✅ **Streaming Otimizado**
- Proxy automático para CORS
- Validação de arquivos M3U8
- Recuperação automática de erros
- Fallback para player nativo

✅ **Debug e Monitoramento**
- Página de debug avançada
- Logs detalhados de streaming
- Teste de conectividade
- Estatísticas em tempo real

### 🔧 Após o Deploy

1. **Teste a Aplicação**:
   - Acesse a URL fornecida pelo Netlify
   - Faça login com as credenciais configuradas
   - Teste o streaming de canais

2. **Debug se Necessário**:
   - Acesse `/debug.html` para diagnósticos
   - Use `/test-hls.html` para testar streaming específico
   - Verifique os logs do Netlify se houver problemas

3. **Configuração de Domínio** (Opcional):
   - Configure um domínio customizado no painel do Netlify
   - Ative HTTPS automático

### 📱 Compatibilidade

- ✅ Chrome, Firefox, Safari, Edge
- ✅ Dispositivos móveis (iOS, Android)
- ✅ Smart TVs com navegador
- ✅ Tablets e desktops

### 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Streaming**: HLS.js para reprodução de vídeo
- **Proxy**: Netlify Redirects para CORS
- **Deploy**: Netlify com configuração automática

### 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Netlify
2. Use as páginas de debug incluídas
3. Confirme se o servidor XTREAM está acessível

---

**🎉 Projeto pronto para produção!**

Todos os arquivos estão otimizados e configurados para funcionar perfeitamente no Netlify.