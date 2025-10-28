# Guia Rápido de Deploy - Archon no Kubernetes

Este guia mostra o caminho mais rápido para fazer deploy do Archon em um cluster Kubernetes.

## Pré-requisitos

- [ ] Cluster Kubernetes funcionando
- [ ] `kubectl` configurado e conectado ao cluster
- [ ] Namespace `unlkd` criado (ou será criado automaticamente)
- [ ] Nginx Ingress Controller instalado
- [ ] Cert Manager instalado com ClusterIssuer `letsencrypt`
- [ ] Docker instalado localmente (para build das imagens)
- [ ] Acesso a um Container Registry (Docker Hub, GCR, DigitalOcean, etc.)
- [ ] Conta Supabase com projeto criado

## Passo 1: Build e Push das Imagens

```bash
# No diretório raiz do projeto Archon
cd /home/luis/projetos/Archon

# Execute o script de build (substitua pelo seu registry)
./k8s/build-and-push.sh docker.io/seuusuario latest
```

Ou para registries específicos:

```bash
# Docker Hub
./k8s/build-and-push.sh docker.io/seuusuario latest

# Google Container Registry
./k8s/build-and-push.sh gcr.io/seu-projeto latest

# DigitalOcean Registry
./k8s/build-and-push.sh registry.digitalocean.com/seu-registry latest

# AWS ECR
./k8s/build-and-push.sh 123456789.dkr.ecr.us-east-1.amazonaws.com/archon latest
```

## Passo 2: Atualizar Referências das Imagens

```bash
cd k8s/

# Substituir 'your-registry' pelo registry real
sed -i 's|your-registry|docker.io/seuusuario|g' *-deployment-*.yaml

# Se não usou 'latest', substitua pela versão correta
sed -i 's|:latest|:v1.0.0|g' *-deployment-*.yaml
```

## Passo 3: Configurar o Secret

Edite o arquivo `01-secret.yaml`:

```bash
vi 01-secret.yaml
```

Configure as variáveis obrigatórias:

```yaml
# Obrigatório
SUPABASE_URL: "https://seu-projeto.supabase.co"
SUPABASE_SERVICE_KEY: "eyJhbGc...sua-chave-service-role"
SUPABASE_ANON_KEY: "eyJhbGc...sua-chave-anon"

# Opcional mas recomendado
OPENAI_API_KEY: "sk-...sua-chave-openai"
```

Para obter as chaves do Supabase:
1. Acesse: https://supabase.com/dashboard/project/SEU_PROJECT_ID/settings/api
2. Copie a URL do projeto
3. Copie a chave `service_role` (NÃO a chave `anon`)
4. Copie a chave `anon` também

## Passo 4: Configurar DNS

Configure os seguintes registros DNS A/CNAME apontando para o IP externo do seu Ingress Controller:

```
archon.digiworker.com.br    → <IP_DO_INGRESS>
server.digiworker.com.br    → <IP_DO_INGRESS>
mcp.digiworker.com.br       → <IP_DO_INGRESS>
agents.digiworker.com.br    → <IP_DO_INGRESS>
```

Para descobrir o IP do Ingress:
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

## Passo 5: Deploy

```bash
# Usando o script auxiliar (recomendado)
./deploy.sh apply

# Ou manualmente
kubectl apply -f .
```

## Passo 6: Verificar o Deploy

```bash
# Verificar status dos pods
./deploy.sh status

# Ou manualmente
kubectl get pods -n unlkd -l app.kubernetes.io/instance=archon
```

Aguarde até todos os pods estarem em status `Running`:

```
NAME                               READY   STATUS    RESTARTS   AGE
archon-server-xxx                  1/1     Running   0          2m
archon-mcp-xxx                     1/1     Running   0          2m
archon-agents-xxx                  1/1     Running   0          2m
archon-frontend-xxx                1/1     Running   0          2m
```

## Passo 7: Verificar Certificados TLS

```bash
kubectl get certificate -n unlkd
```

Os certificados devem estar com status `Ready: True`:

```
NAME                    READY   SECRET                  AGE
archon-frontend-tls     True    archon-frontend-tls     5m
archon-server-tls       True    archon-server-tls       5m
archon-mcp-tls          True    archon-mcp-tls          5m
archon-agents-tls       True    archon-agents-tls       5m
```

Se não estiverem prontos, aguarde alguns minutos. O Cert Manager precisa validar o domínio e emitir os certificados.

## Passo 8: Acessar a Aplicação

Acesse no navegador:
- Frontend: https://archon.digiworker.com.br
- API: https://server.digiworker.com.br/health
- MCP: https://mcp.digiworker.com.br/health
- Agents: https://agents.digiworker.com.br/health

## Comandos Úteis

### Ver logs de um serviço
```bash
./deploy.sh logs
# Ou manualmente:
kubectl logs -n unlkd -l app.kubernetes.io/name=archon-server -f
```

### Reiniciar um serviço
```bash
./deploy.sh restart
# Ou manualmente:
kubectl rollout restart deployment/archon-server -n unlkd
```

### Atualizar uma imagem
```bash
# Build nova versão
./k8s/build-and-push.sh docker.io/seuusuario v1.1.0

# Atualizar deployment
kubectl set image deployment/archon-server -n unlkd \
  archon-server=docker.io/seuusuario/archon-server:v1.1.0
```

### Escalar replicas
```bash
kubectl scale deployment/archon-server -n unlkd --replicas=3
```

### Ver eventos do cluster
```bash
kubectl get events -n unlkd --sort-by='.lastTimestamp'
```

## Troubleshooting

### Pods com status CrashLoopBackOff

```bash
# Ver logs do pod
kubectl logs -n unlkd <pod-name>

# Ver detalhes do pod
kubectl describe pod -n unlkd <pod-name>
```

Causas comuns:
- Credenciais do Supabase incorretas
- Imagem não encontrada no registry
- Portas conflitantes

### Certificados TLS não são emitidos

```bash
# Verificar status do certificado
kubectl describe certificate -n unlkd archon-frontend-tls

# Ver logs do cert-manager
kubectl logs -n cert-manager -l app=cert-manager -f
```

Causas comuns:
- DNS não está apontando corretamente
- ClusterIssuer `letsencrypt` não configurado
- Rate limit do Let's Encrypt (espere 1 hora)

### Serviços não se comunicam

```bash
# Testar conectividade entre pods
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n unlkd -- sh

# Dentro do pod:
curl http://archon-server:8181/health
curl http://archon-mcp:8051/health
curl http://archon-agents:8052/health
```

### Ingress não roteia corretamente

```bash
# Verificar ingress
kubectl describe ingress archon -n unlkd

# Ver logs do nginx ingress
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller -f
```

## Próximos Passos

1. **Configurar Backup do Secret**
   - Considere usar Sealed Secrets ou External Secrets Operator

2. **Adicionar Monitoring**
   - Configure Prometheus e Grafana para monitorar o cluster

3. **Configurar Auto-scaling**
   ```bash
   kubectl autoscale deployment archon-server -n unlkd --cpu-percent=70 --min=1 --max=5
   ```

4. **Adicionar NetworkPolicies**
   - Restrinja comunicação entre pods

5. **Configurar Persistent Storage**
   - Se precisar armazenar dados localmente

## Limpeza

Para remover completamente a aplicação:

```bash
./deploy.sh delete
```

Ou manualmente:

```bash
kubectl delete -f k8s/
```

## Suporte

Para mais detalhes, consulte:
- [README.md](README.md) - Documentação completa
- [Docker Compose](../docker-compose.yml) - Configuração de referência
- [.env.example](../.env.example) - Variáveis de ambiente disponíveis
