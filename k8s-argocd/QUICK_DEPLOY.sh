#!/bin/bash

# Script Rápido de Deploy - Archon via ArgoCD
# Este script facilita a atualização da aplicação Archon no ArgoCD

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configurações
ARGOCD_SERVER="argo.automatizase.com.br"
ARGOCD_USER="admin"
ARGOCD_PASS="ngVMwCYWN0GynH0g"
APP_NAME="argocd/archon"
GIT_REPO="git@github.com:LuisErlacher/k8s-templates.git"
GIT_PATH="apps/custom/archon/base"

print_info "=== Deploy Rápido do Archon via ArgoCD ==="
echo ""

# Verificar se ArgoCD CLI está instalado
if ! command -v argocd &> /dev/null; then
    print_error "ArgoCD CLI não está instalado!"
    print_info "Instale com: curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64 && sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd"
    exit 1
fi

# Login no ArgoCD
print_info "Fazendo login no ArgoCD..."
if argocd login "$ARGOCD_SERVER" --username "$ARGOCD_USER" --password "$ARGOCD_PASS" --grpc-web > /dev/null 2>&1; then
    print_success "Login realizado com sucesso"
else
    print_error "Falha no login do ArgoCD"
    exit 1
fi

# Menu
echo ""
echo "Escolha uma opção:"
echo "1) Ver status atual"
echo "2) Sync (aplicar alterações do Git)"
echo "3) Ver logs do MCP"
echo "4) Ver logs do Server"
echo "5) Ver logs do Agents"
echo "6) Ver logs do Frontend"
echo "7) Ver todos os recursos"
echo "8) Testar endpoints"
echo "9) Hard Refresh (sync com prune e force)"
echo "0) Sair"
echo ""
read -p "Opção: " option

case $option in
    1)
        print_info "Status da aplicação:"
        argocd app get "$APP_NAME"
        ;;

    2)
        print_info "Sincronizando aplicação..."
        argocd app sync "$APP_NAME" --prune
        print_success "Sync concluído"
        echo ""
        print_info "Aguarde alguns segundos e execute a opção 1 para ver o status"
        ;;

    3)
        print_info "Logs do MCP (últimas 100 linhas):"
        argocd app logs "$APP_NAME" --kind Deployment --name archon-mcp --tail 100
        ;;

    4)
        print_info "Logs do Server (últimas 100 linhas):"
        argocd app logs "$APP_NAME" --kind Deployment --name archon-server --tail 100
        ;;

    5)
        print_info "Logs do Agents (últimas 100 linhas):"
        argocd app logs "$APP_NAME" --kind Deployment --name archon-agents --tail 100
        ;;

    6)
        print_info "Logs do Frontend (últimas 100 linhas):"
        argocd app logs "$APP_NAME" --kind Deployment --name archon-frontend --tail 100
        ;;

    7)
        print_info "Todos os recursos:"
        argocd app resources "$APP_NAME"
        ;;

    8)
        print_info "Testando endpoints..."
        echo ""

        print_info "Frontend:"
        curl -sI https://archon.automatizase.com.br/ | head -1

        print_info "Backend Health:"
        curl -s https://archon.automatizase.com.br/health | head -c 200
        echo ""

        print_info "API Health:"
        curl -s https://archon.automatizase.com.br/api/health | head -c 200
        echo ""

        print_info "Agents Health:"
        curl -s https://archon.automatizase.com.br/agents/health | head -c 200
        echo ""

        print_info "MCP (pode retornar 406 sem sessão):"
        curl -sI https://archon.automatizase.com.br/mcp/health | head -1
        ;;

    9)
        print_warning "Isso irá forçar o sync e remover recursos não gerenciados"
        read -p "Tem certeza? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Hard refresh em andamento..."
            argocd app sync "$APP_NAME" --prune --force
            print_success "Hard refresh concluído"
        else
            print_info "Operação cancelada"
        fi
        ;;

    0)
        print_info "Saindo..."
        exit 0
        ;;

    *)
        print_error "Opção inválida"
        exit 1
        ;;
esac

echo ""
print_success "Operação concluída!"
