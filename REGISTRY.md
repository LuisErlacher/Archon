# Usando Imagens do Registry Gitea

Este documento descreve como usar as imagens Docker do Archon a partir do registry privado do Gitea.

## Registry Information

**Registry URL:** `git.automatizase.com.br`
**Repository:** `luis.erlacher/archon`

## Imagens Disponíveis

Todas as imagens são buildadas automaticamente via Gitea Actions e publicadas com múltiplas tags:

| Serviço | Imagem | Descrição |
|---------|--------|-----------|
| **Server** | `git.automatizase.com.br/luis.erlacher/archon/server` | FastAPI + Crawling + Socket.IO |
| **MCP** | `git.automatizase.com.br/luis.erlacher/archon/mcp` | MCP Server para IDEs |
| **Frontend** | `git.automatizase.com.br/luis.erlacher/archon/frontend` | React UI |
| **Agents** | `git.automatizase.com.br/luis.erlacher/archon/agents` | AI Agents (opcional) |

## Tags Disponíveis

Cada imagem é publicada com 3 tags:

- **`latest`** - Última versão estável da branch main
- **`v1.0.X`** - Versão semântica (X = número do build)
- **`SHORT_SHA`** - Hash curto do commit (7 caracteres)

### Exemplos:
```bash
git.automatizase.com.br/luis.erlacher/archon/server:latest
git.automatizase.com.br/luis.erlacher/archon/server:v1.0.42
git.automatizase.com.br/luis.erlacher/archon/server:a3c2f1e
```

## Autenticação no Registry

### 1. Login com Docker

```bash
docker login git.automatizase.com.br
# Username: luis.erlacher
# Password: [seu token de acesso]
```

### 2. Gerar Token de Acesso

1. Acesse: https://git.automatizase.com.br/user/settings/applications
2. Clique em "Generate New Token"
3. Selecione permissões: `read:package`, `write:package`
4. Use o token gerado como senha no docker login

## Uso em Docker Compose

### Opção 1: Usar arquivo fornecido

```bash
# Copiar arquivo .env de exemplo
cp .env.example .env

# Editar variáveis de ambiente necessárias
nano .env

# Subir com imagens do registry
docker compose -f docker-compose.registry.yml up -d

# Com agents (opcional)
docker compose -f docker-compose.registry.yml --profile agents up -d
```

### Opção 2: Criar seu próprio compose

```yaml
services:
  archon-server:
    image: git.automatizase.com.br/luis.erlacher/archon/server:v1.0.42
    # ... configurações

  archon-mcp:
    image: git.automatizase.com.br/luis.erlacher/archon/mcp:v1.0.42
    # ... configurações

  archon-frontend:
    image: git.automatizase.com.br/luis.erlacher/archon/frontend:v1.0.42
    # ... configurações
```

## Uso em Kubernetes

### 1. Criar Secret para Registry

```bash
kubectl create secret docker-registry gitea-registry \
  --docker-server=git.automatizase.com.br \
  --docker-username=luis.erlacher \
  --docker-password=<seu-token> \
  --docker-email=lperlacher@gmail.com
```

### 2. Usar em Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: archon-server
spec:
  template:
    spec:
      imagePullSecrets:
        - name: gitea-registry
      containers:
        - name: server
          image: git.automatizase.com.br/luis.erlacher/archon/server:v1.0.42
          ports:
            - containerPort: 8181
```

## Versionamento

### Usando Tags Específicas (Recomendado para Produção)

```yaml
services:
  archon-server:
    image: git.automatizase.com.br/luis.erlacher/archon/server:v1.0.42
```

**Vantagens:**
- Builds reproduzíveis
- Rollback fácil
- Não quebra com atualizações

### Usando Latest (Desenvolvimento)

```yaml
services:
  archon-server:
    image: git.automatizase.com.br/luis.erlacher/archon/server:latest
```

**Vantagens:**
- Sempre atualizado
- Ideal para staging/dev

## CI/CD Pipeline

O workflow `.gitea/workflows/build-push-images.yml` é disparado:

1. **Em push para main** - Cria versão `v1.0.X` e `latest`
2. **Em tags git** - Usa a tag como versão (ex: `v2.0.0`)
3. **Manual** - Via workflow_dispatch no Gitea Actions

### Criar Release com Tag

```bash
git tag -a v2.0.0 -m "Release version 2.0.0"
git push origin v2.0.0
```

Isso irá buildar e publicar todas as imagens com tag `v2.0.0`.

## Variáveis de Ambiente Necessárias

No Gitea Actions, configure os secrets:

- `GITEA_USERNAME` - Usuário do Gitea (luis.erlacher)
- `GITEA_TOKEN` - Token de acesso com permissões de package

### Configurar Secrets no Gitea

1. Acesse: https://git.automatizase.com.br/luis.erlacher/Archon/settings/secrets
2. Adicione:
   - Name: `GITEA_USERNAME`, Value: `luis.erlacher`
   - Name: `GITEA_TOKEN`, Value: `[seu token]`

## Troubleshooting

### Erro de Autenticação

```bash
# Verificar login
docker logout git.automatizase.com.br
docker login git.automatizase.com.br

# Pull de teste
docker pull git.automatizase.com.br/luis.erlacher/archon/server:latest
```

### Ver Versões Disponíveis

Acesse: https://git.automatizase.com.br/luis.erlacher/-/packages

### Limpar Imagens Antigas Localmente

```bash
docker images | grep "git.automatizase.com.br" | awk '{print $3}' | xargs docker rmi
```

## Para DevOps/SRE

### Helm Chart (exemplo básico)

```yaml
# values.yaml
image:
  registry: git.automatizase.com.br
  repository: luis.erlacher/archon
  tag: v1.0.42
  pullSecrets:
    - gitea-registry

server:
  image: "{{ .Values.image.registry }}/{{ .Values.image.repository }}/server:{{ .Values.image.tag }}"

mcp:
  image: "{{ .Values.image.registry }}/{{ .Values.image.repository }}/mcp:{{ .Values.image.tag }}"
```

### ArgoCD Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: archon
spec:
  source:
    repoURL: https://git.automatizase.com.br/luis.erlacher/Archon.git
    targetRevision: main
    path: k8s/manifests
  destination:
    server: https://kubernetes.default.svc
    namespace: archon
```

## Suporte

Para issues ou dúvidas:
- Issues: https://git.automatizase.com.br/luis.erlacher/Archon/issues
- CI/CD Logs: https://git.automatizase.com.br/luis.erlacher/Archon/actions
