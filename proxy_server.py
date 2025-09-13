#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor proxy simples para desenvolvimento local do XTREAM Web Player
Este servidor processa os redirects definidos no arquivo _redirects
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
from urllib.error import URLError, HTTPError
import socket
import os

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Carregar redirects do arquivo _redirects
        self.redirects = self.load_redirects()
        super().__init__(*args, **kwargs)
    
    def load_redirects(self):
        """Carrega as regras de redirect do arquivo _redirects"""
        redirects = []
        try:
            with open('_redirects', 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        parts = line.split()
                        if len(parts) >= 2:
                            from_path = parts[0]
                            to_url = parts[1]
                            redirects.append((from_path, to_url))
        except FileNotFoundError:
            print("⚠️ Arquivo _redirects não encontrado")
        return redirects
    
    def do_GET(self):
        self.handle_request()
    
    def do_HEAD(self):
        self.handle_request()
    
    def do_POST(self):
        self.handle_request()
    
    def do_OPTIONS(self):
        # Adicionar headers CORS para OPTIONS
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def handle_request(self):
        path = self.path.split('?')[0]  # Remove query string para matching
        query_string = self.path.split('?')[1] if '?' in self.path else ''
        
        print(f"🔍 Processando requisição: {path}")
        
        # Verificar se é uma requisição de API que precisa de proxy
        proxy_url = None
        for from_path, to_url in self.redirects:
            print(f"  🔎 Testando pattern: {from_path} vs {path}")
            if self.match_path(from_path, path):
                print(f"  ✅ Match encontrado: {from_path}")
                # Substituir wildcards
                if from_path.endswith('/*'):
                    base_from = from_path[:-2]
                    if path.startswith(base_from):
                        remaining = path[len(base_from):]
                        # Remover barra inicial do remaining se to_url já termina com barra
                        if to_url.endswith('/') and remaining.startswith('/'):
                            remaining = remaining[1:]
                        proxy_url = to_url.replace(':splat', remaining)
                        print(f"  🔄 Wildcard substituído: {remaining}")
                elif from_path == path:
                    proxy_url = to_url
                break
            else:
                print(f"  ❌ Não fez match: {from_path}")
        
        if proxy_url:
            # Adicionar query string se existir
            if query_string:
                proxy_url += '?' + query_string
            
            print(f"🔄 Proxy: {self.path} -> {proxy_url}")
            self.proxy_request(proxy_url)
        else:
            print(f"❌ Nenhum redirect encontrado para: {path}")
            # Servir arquivo local normalmente
            super().do_GET()
    
    def match_path(self, pattern, path):
        """Verifica se o path corresponde ao pattern"""
        if pattern.endswith('/*'):
            return path.startswith(pattern[:-2])
        return pattern == path
    
    def proxy_request(self, url):
        """Faz proxy da requisição para o servidor XTREAM"""
        try:
            print(f"🔗 Tentando conectar: {url}")
            
            # Criar requisição
            req = urllib.request.Request(url)
            
            # Adicionar User-Agent de navegador para evitar bloqueios
            req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
            
            # Copiar outros headers relevantes
            for header in ['Accept', 'Accept-Language']:
                if header in self.headers:
                    req.add_header(header, self.headers[header])
            
            # Fazer requisição com timeout menor
            with urllib.request.urlopen(req, timeout=15) as response:
                print(f"✅ Conectado com sucesso: {response.getcode()}")
                
                # Enviar resposta
                self.send_response(response.getcode())
                
                # Adicionar headers CORS
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                
                # Copiar headers da resposta
                for header, value in response.headers.items():
                    if header.lower() not in ['server', 'date', 'connection']:
                        self.send_header(header, value)
                
                self.end_headers()
                
                # Copiar conteúdo
                content = response.read()
                print(f"📦 Conteúdo recebido: {len(content)} bytes")
                
                # Verificar se é arquivo HLS e validar conteúdo
                if url.endswith('.m3u8'):
                    content_str = content.decode('utf-8', errors='ignore')
                    if not content_str.startswith('#EXTM3U'):
                        print(f"⚠️ Arquivo M3U8 inválido detectado: {url}")
                        print(f"📄 Conteúdo: {content_str[:200]}...")
                        # Tentar corrigir adicionando header M3U8
                        if content_str.strip():
                            content = b'#EXTM3U\n' + content
                            print(f"🔧 Header M3U8 adicionado")
                
                self.wfile.write(content)
                
        except HTTPError as e:
            print(f"❌ HTTP Error {e.code}: {e.reason} para URL: {url}")
            try:
                self.send_error(e.code, f"Servidor retornou erro: {e.reason}")
            except:
                pass  # Conexão já foi fechada
        except URLError as e:
            print(f"❌ URL Error: {e.reason} para URL: {url}")
            try:
                self.send_error(502, f"Erro de conectividade com o servidor XTREAM: {e.reason}")
            except:
                pass  # Conexão já foi fechada
        except socket.timeout:
            print(f"⏰ Timeout ao conectar: {url}")
            try:
                self.send_error(504, "Timeout: O servidor XTREAM não respondeu a tempo")
            except:
                pass  # Conexão já foi fechada
        except ConnectionAbortedError:
            print(f"🔌 Conexão abortada pelo cliente para: {url}")
            # Não tentar enviar resposta se a conexão foi abortada
        except ConnectionResetError:
            print(f"🔌 Conexão resetada para: {url}")
            # Não tentar enviar resposta se a conexão foi resetada
        except BrokenPipeError:
            print(f"🔌 Pipe quebrado para: {url}")
            # Cliente desconectou, não tentar enviar resposta
        except urllib.error.HTTPError as e:
            print(f"❌ Erro HTTP {e.code}: {e.reason} para {url}")
            if e.code == 404:
                print(f"📄 Arquivo não encontrado no servidor: {url}")
            try:
                self.send_error(e.code, f"Erro do servidor: {e.reason}")
            except:
                pass  # Conexão já foi fechada
        except urllib.error.URLError as e:
            print(f"❌ Erro de conexão: {e.reason} para {url}")
            try:
                self.send_error(502, f"Erro de conexão: {e.reason}")
            except:
                pass  # Conexão já foi fechada
        except Exception as e:
            print(f"❌ Erro inesperado: {e} para URL: {url}")
            try:
                # Para arquivos HLS (.ts), tentar resposta mais específica
                if url.endswith('.ts'):
                    self.send_error(503, f"Erro no streaming HLS: {str(e)}")
                else:
                    self.send_error(500, f"Erro interno do proxy: {str(e)}")
            except:
                pass  # Conexão já foi fechada

def load_redirects_standalone():
    """Carrega as regras de redirect do arquivo _redirects"""
    redirects = []
    try:
        with open('_redirects', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split()
                    if len(parts) >= 2:
                        from_path = parts[0]
                        to_url = parts[1]
                        redirects.append((from_path, to_url))
    except FileNotFoundError:
        print("⚠️ Arquivo _redirects não encontrado")
    return redirects

if __name__ == "__main__":
    PORT = int(os.environ.get('PORT', 8000))
    
    print(f"🚀 Iniciando servidor proxy na porta {PORT}")
    print(f"📂 Diretório: {os.getcwd()}")
    print(f"🌐 Acesse: http://localhost:{PORT}")
    print("\n📋 Redirects carregados:")
    
    redirects = load_redirects_standalone()
    for from_path, to_url in redirects:
        print(f"  {from_path} -> {to_url}")
    
    print("\n⏹️ Pressione Ctrl+C para parar\n")
    
    with socketserver.TCPServer(("0.0.0.0", PORT), ProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Servidor parado")
            httpd.shutdown()