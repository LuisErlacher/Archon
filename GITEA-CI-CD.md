# Gitea CI/CD - Build de Imagens Archon

## 📦 Workflow Automático

O workflow `.gitea/workflows/build-images.yml` faz build e push automático das **4 imagens de produção** quando há commits na branch `main`.

## 🏗️ Imagens Buildadas

### 1. **archon-server**
- **Dockerfile**: `python/Dockerfile.server`
- **Tags**:
  - `git.automatizase.com.br/luis.erlacher/archon/server:latest`
  - `git.automatizase.com.br/luis.erlacher/archon/server:<commit-sha>`
- **Descrição**: FastAPI + Socket.IO + Web Crawling
- **Porta**: 8181

### 2. **archon-mcp**
- **Dockerfile**: `python/Dockerfile.mcp`
- **Tags**:
  - `git.automatizase.com.br/luis.erlacher/archon/mcp:latest`
  - `git.automatizase.com.br/luis.erlacher/archon/mcp:<commit-sha>`
- **Descrição**: MCP Server HTTP (Model Context Protocol)
- **Porta**: 8051

### 3. **archon-frontend** ⭐ PRODUÇÃO
- **Dockerfile**: `archon-ui-main/Dockerfile.production`
- **Tags**:
  - `git.automatizase.com.br/luis.erlacher/archon/frontend:latest`
  - `git.automatizase.com.br/luis.erlacher/archon/frontend:<commit-sha>`
- **Descrição**: React build + Nginx (PRODUÇÃO)
- **Porta**: 3737
- **⚠️ IMPORTANTE**: Usa `Dockerfile.production` (não `Dockerfile`)

### 4. **archon-agents**
- **Dockerfile**: `python/Dockerfile.agents`
- **Tags**:
  - `git.automatizase.com.br/luis.erlacher/archon/agents:latest`
  - `git.automatizase.com.br/luis.erlacher/archon/agents:<commit-sha>`
- **Descrição**: AI Agents (PydanticAI + ML/Reranking)
- **Porta**: 8052

## 🔄 Como Funciona

### Trigger Automático
```yaml
on:
  push:
    branches:
      - main        # Qualquer push na main dispara o build
  workflow_dispatch: # Ou execução manual via UI
```

### Processo de Build
1. **Checkout** do código no commit específico
2. **Build** da imagem com 2 tags:
   - `latest` - sempre aponta para o último build
   - `<commit-sha>` - versão específica do commit (rastreabilidade)
3. **Push** de ambas as tags para o registry Gitea

### Execução Paralela
Todos os 4 jobs rodam em **paralelo** para máxima velocidade:
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│build-server │  │ build-mcp   │  │build-frontend│ │build-agents │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
      ↓                  ↓                  ↓                ↓
  [Registry]        [Registry]        [Registry]       [Registry]
```

## 🚀 Deploy no Kubernetes

Após o build automático, as imagens ficam disponíveis no registry Gitea.

### Usando tag `latest`
```yaml
# k8s-manifests-complete.yaml (já configurado)
image: git.automatizase.com.br/luis.erlacher/archon/server:latest
image: git.automatizase.com.br/luis.erlacher/archon/mcp:latest
image: git.automatizase.com.br/luis.erlacher/archon/frontend:latest
```

### Usando commit SHA específico (recomendado para produção)
```yaml
# Pinning em versão específica para estabilidade
image: git.automatizase.com.br/luis.erlacher/archon/server:abc123def
image: git.automatizase.com.br/luis.erlacher/archon/mcp:abc123def
image: git.automatizase.com.br/luis.erlacher/archon/frontend:abc123def
```

### Aplicar no K8s
```bash
# Após commit e build automático
kubectl apply -f k8s-manifests-complete.yaml

# Forçar pull da nova imagem (se usar :latest)
kubectl rollout restart deployment -n archon archon-server
kubectl rollout restart deployment -n archon archon-mcp
kubectl rollout restart deployment -n archon archon-frontend
```

## 📊 Versionamento com Tags

### Estrutura de Tags
Cada build cria 2 tags:

```
git.automatizase.com.br/luis.erlacher/archon/server:latest
git.automatizase.com.br/luis.erlacher/archon/server:a1b2c3d4e5f6...
                                                    └─ commit SHA
```

### Benefícios
✅ **Rastreabilidade**: Saber exatamente qual código está em cada imagem
✅ **Rollback**: Voltar para versão anterior facilmente
✅ **Auditoria**: Histórico completo de builds

### Exemplo de Rollback
```bash
# Ver histórico de imagens
docker images git.automatizase.com.br/luis.erlacher/archon/server

# Rollback para SHA anterior
kubectl set image deployment/archon-server \
  -n archon \
  server=git.automatizase.com.br/luis.erlacher/archon/server:abc123def
```

## 📝 Modificações Recentes

### ⭐ Frontend PRODUÇÃO (CORRIGIDO)
- **Antes**: `Dockerfile` (dev mode com `npm run dev`)
- **Depois**: `Dockerfile.production` (produção com Nginx)
- **Arquivo**: `.gitea/workflows/build-images.yml` linha 53
- **Benefícios**:
  - ✅ Build otimizado do Vite
  - ✅ Nginx servindo arquivos estáticos
  - ✅ Gzip compression
  - ✅ Cache de assets (JS/CSS/imagens)
  - ✅ Security headers

### ⭐ Tags com SHA (NOVO)
- **Antes**: Somente tag `latest`
- **Depois**: `latest` + `<commit-sha>`
- **Benefício**: Rastreabilidade completa e rollback fácil

## 🐛 Troubleshooting

### Build falha com erro de permissão
```bash
# Verificar login no registry
docker login git.automatizase.com.br

# Verificar se o runner tem acesso ao Docker
docker ps
```

### Imagem não atualiza no K8s
```bash
# Se usar :latest, precisa forçar pull
kubectl rollout restart deployment -n archon <deployment-name>

# Ou use imagePullPolicy: Always no manifesto (já configurado)
```

### Frontend ainda usa modo dev
⚠️ **SINTOMA**: Vite dev server rodando na porta 3737
✅ **SOLUÇÃO**: Workflow já corrigido para usar `Dockerfile.production`

## 📌 Fluxo Completo de Deploy

```
1. Desenvolvedor faz commit na main
         ↓
2. Gitea Actions dispara workflow automaticamente
         ↓
3. Build paralelo das 4 imagens
         ↓
4. Push para registry Gitea (2 tags cada)
         ↓
5. Imagens disponíveis:
   - server:latest + server:<sha>
   - mcp:latest + mcp:<sha>
   - frontend:latest + frontend:<sha> (PRODUÇÃO com Nginx)
   - agents:latest + agents:<sha>
         ↓
6. kubectl apply -f k8s-manifests-complete.yaml
         ↓
7. Kubernetes puxa novas imagens
         ↓
8. Pods atualizam automaticamente
         ↓
9. Aplicação em produção com nova versão
```

## 🔗 Arquivos Relacionados

- **Workflow**: `.gitea/workflows/build-images.yml`
- **Frontend Produção**: `archon-ui-main/Dockerfile.production`
- **Frontend Config**: `archon-ui-main/nginx.conf`
- **Manifestos K8s**: `k8s-manifests-complete.yaml`
- **Guia Deploy**: `K8S-DEPLOY-GUIDE.md`
- **Backend Modificado**: `python/src/server/api_routes/mcp_api.py`

## ✅ Checklist Pós-Commit

Após push na `main`:

- [ ] Workflow executado com sucesso
- [ ] 4 jobs completados (server, mcp, frontend, agents)
- [ ] 8 tags criadas no registry (2 por imagem)
- [ ] Imagens disponíveis no registry Gitea
- [ ] K8s atualizado: `kubectl apply -f k8s-manifests-complete.yaml`
- [ ] Pods reiniciados (se necessário): `kubectl rollout restart`
- [ ] Frontend servindo com Nginx (não Vite dev)
- [ ] MCP funcionando sem erro `FileNotFoundError`
- [ ] Aplicação funcionando em https://archon.automatizase.com.br
