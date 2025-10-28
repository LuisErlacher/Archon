# Resumo Executivo - Deploy Archon via ArgoCD

## Status Atual

✅ **ArgoCD CLI instalado e conectado**
✅ **Aplicação Archon localizada e analisada**
✅ **Problemas identificados**
✅ **Manifestos corrigidos criados**

## Problemas Encontrados

### 🔴 Críticos
1. **ConfigMap vazio** - Todas as variáveis de ambiente faltando
2. **MCP sem comunicação com backend** - Tentava localhost:8181 em vez do service Kubernetes
3. **Deployment de Agents ausente** - Serviço não configurado

### 🟡 Importantes
4. Variáveis de ambiente incompletas em todos os deployments
5. Ingress sem path para agents

## Correções Aplicadas

### ✅ Arquivos Criados em `/home/luis/projetos/Archon/k8s-argocd/`

1. **configmap.yaml** - ConfigMap preenchido com todas as variáveis
2. **deployment-server.yaml** - Deployment do backend com variáveis corretas
3. **deployment-mcp.yaml** - MCP com `API_SERVICE_URL` e `AGENTS_SERVICE_URL`
4. **deployment-agents.yaml** - Novo deployment para AI agents
5. **deployment-frontend.yaml** - Frontend mantido com ajustes
6. **service-server.yaml** - Service para backend
7. **service-mcp.yaml** - Service para MCP
8. **service-agents.yaml** - Novo service para agents
9. **service-frontend.yaml** - Service para frontend
10. **ingress.yaml** - Ingress com novo path `/agents`
11. **kustomization.yaml** - Kustomize config
12. **README.md** - Documentação completa

### ✅ Documentação Criada

- **ARCHON_ARGOCD_DIAGNOSTIC.md** - Diagnóstico detalhado completo
- **DEPLOY_ARGOCD_SUMMARY.md** - Este arquivo (resumo executivo)

## Próximos Passos

### Passo 1: Atualizar Repositório Git

Você precisa copiar os manifestos para o repositório k8s-templates:

```bash
# Clone o repositório (se ainda não tiver)
git clone git@github.com:LuisErlacher/k8s-templates.git
cd k8s-templates

# Faça backup do diretório atual
mv apps/custom/archon/base apps/custom/archon/base.backup

# Copie os novos manifestos
cp -r /home/luis/projetos/Archon/k8s-argocd apps/custom/archon/base

# Commit e push
git add apps/custom/archon/base/
git commit -m "fix: Corrige configuração do Archon

- Preenche ConfigMap com todas as variáveis necessárias
- Adiciona API_SERVICE_URL no MCP para comunicação interna
- Adiciona deployment e service do archon-agents
- Atualiza ingress com path /agents
- Corrige variáveis de ambiente em todos os deployments

Closes: Problemas de conectividade entre MCP e backend"

git push origin main
```

### Passo 2: Sync no ArgoCD

Após o push, faça sync da aplicação:

```bash
# Já logado no ArgoCD
argocd app sync argocd/archon --prune
```

### Passo 3: Verificar Deploy

```bash
# Verificar status
argocd app get argocd/archon

# Ver logs do MCP (deve mostrar conexão OK)
argocd app logs argocd/archon --kind Deployment --name archon-mcp --tail 50

# Ver logs do novo agents
argocd app logs argocd/archon --kind Deployment --name archon-agents --tail 50
```

### Passo 4: Testar Endpoints

```bash
# Health checks
curl https://archon.automatizase.com.br/health
curl https://archon.automatizase.com.br/api/health
curl https://archon.automatizase.com.br/agents/health

# Frontend
curl -I https://archon.automatizase.com.br/
```

## O Que Foi Corrigido

### ConfigMap (Antes vs Depois)

**Antes**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: archon-config
# VAZIO - sem data!
```

**Depois**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: archon-config
data:
  ARCHON_SERVER_PORT: "8181"
  ARCHON_MCP_PORT: "8051"
  ARCHON_AGENTS_PORT: "8052"
  HOST: "archon.automatizase.com.br"
  SERVICE_DISCOVERY_MODE: "kubernetes"
  LOG_LEVEL: "INFO"
```

### MCP Deployment (Variáveis Críticas Adicionadas)

**Adicionado**:
```yaml
- name: API_SERVICE_URL
  value: http://archon-server-service:8181  # ← CRÍTICO! Era localhost antes
- name: AGENTS_ENABLED
  value: "true"
- name: AGENTS_SERVICE_URL
  value: http://archon-agents-service:8052
- name: TRANSPORT
  value: "sse"
```

### Agents Deployment (Novo)

Criado completamente novo:
- Image: `coleam00/archon-agents:latest`
- Port: 8052
- Resources: 500m CPU / 1Gi RAM → 2 CPU / 4Gi RAM
- Health checks configurados
- Conectado ao Supabase

### Ingress (Path Adicionado)

**Adicionado**:
```yaml
- path: /agents
  pathType: Prefix
  backend:
    service:
      name: archon-agents-service
      port:
        number: 8052
```

## Recursos Totais

### Antes
- 8 recursos principais
- ConfigMap vazio
- 3 deployments (server, mcp, frontend)
- 3 services
- 1 ingress

### Depois
- 11 recursos principais
- ConfigMap preenchido ✅
- 4 deployments (server, mcp, **agents**, frontend) ✅
- 4 services ✅
- 1 ingress (com path /agents) ✅

## Logs Esperados Após Correção

### MCP (Antes - Com Erro)
```
2025-10-07 23:38:57 | mcp | WARNING | API service health check failed: All connection attempts failed
2025-10-07 23:38:57 | __main__ | WARNING | Health check failed: {'status': 'degraded', 'api_service': False, 'agents_service': False}
```

### MCP (Depois - Esperado)
```
2025-10-27 XX:XX:XX | mcp | INFO | API service health check: OK
2025-10-27 XX:XX:XX | mcp | INFO | Agents service health check: OK
2025-10-27 XX:XX:XX | __main__ | INFO | Health check success: {'status': 'healthy', 'api_service': True, 'agents_service': True}
```

## Arquitetura de Serviços

```
┌─────────────────────────────────────────────────────┐
│                     Ingress                          │
│        archon.automatizase.com.br                   │
└──────────────┬──────────────────────────────────────┘
               │
       ┌───────┴────────┬─────────┬──────────┬────────┐
       │                │         │          │        │
   /api & /health    /socket.io  /mcp    /agents    /
       │                │         │          │        │
       v                v         v          v        v
┌──────────────┐  ┌─────────┐ ┌─────┐  ┌────────┐ ┌──────────┐
│   Backend    │  │ Backend │ │ MCP │  │ Agents │ │ Frontend │
│   :8181      │  │ :8181   │ │:8051│  │ :8052  │ │  :3737   │
└──────────────┘  └─────────┘ └──┬──┘  └───┬────┘ └──────────┘
                                  │         │
                                  │ Comunicação Interna
                                  │         │
                       ┌──────────┴─────────┴──────────┐
                       │ archon-server-service:8181    │
                       │ archon-agents-service:8052    │
                       └───────────────────────────────┘
```

## Checklist de Verificação

Após o deploy, verifique:

- [ ] Todos os 4 deployments com status Running
- [ ] ConfigMap tem 6 variáveis definidas
- [ ] Logs do MCP mostram conexão OK com backend e agents
- [ ] Logs do agents mostram inicialização correta
- [ ] Frontend acessível em https://archon.automatizase.com.br/
- [ ] Backend responde em https://archon.automatizase.com.br/health
- [ ] Agents responde em https://archon.automatizase.com.br/agents/health
- [ ] MCP acessível (pode retornar 406 sem sessão, mas deve responder)

## Troubleshooting

### Se MCP ainda mostrar erro de conexão

1. Verificar se o service backend está acessível:
   ```bash
   kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n automatizase -- \
     curl http://archon-server-service:8181/health
   ```

2. Verificar logs do MCP em detalhes:
   ```bash
   argocd app logs argocd/archon --kind Deployment --name archon-mcp --tail 200
   ```

### Se Agents não iniciar

1. Verificar secret do Supabase:
   ```bash
   kubectl get secret supabase-jwt -n automatizase -o yaml
   ```

2. Verificar logs:
   ```bash
   argocd app logs argocd/archon --kind Deployment --name archon-agents --tail 100
   ```

### Se Sync falhar

1. Ver detalhes do erro:
   ```bash
   argocd app get argocd/archon
   ```

2. Verificar diff:
   ```bash
   argocd app diff argocd/archon
   ```

## Contatos e Referências

- **Repositório Git**: git@github.com:LuisErlacher/k8s-templates.git
- **Path no Repo**: apps/custom/archon/base
- **ArgoCD URL**: https://argo.automatizase.com.br
- **App Name**: argocd/archon
- **Namespace**: automatizase
- **Domínio**: https://archon.automatizase.com.br

## Arquivos de Referência

- `k8s-argocd/README.md` - Instruções detalhadas
- `ARCHON_ARGOCD_DIAGNOSTIC.md` - Diagnóstico completo
- `k8s-argocd/*.yaml` - Manifestos corrigidos

---

**Status**: ✅ Pronto para deploy
**Data**: 2025-10-27
**Criado por**: Claude Code (Archon deployment fix)
