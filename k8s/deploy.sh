#!/bin/bash

# Script de deploy do Archon no Kubernetes
# Uso: ./deploy.sh [apply|delete|status|logs]

set -e

NAMESPACE="unlkd"
APP_NAME="archon"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
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

# Verificar se kubectl está instalado
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl não está instalado"
        exit 1
    fi
}

# Verificar se o namespace existe
check_namespace() {
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        print_warning "Namespace $NAMESPACE não existe"
        read -p "Deseja criar o namespace? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kubectl create namespace "$NAMESPACE"
            print_success "Namespace $NAMESPACE criado"
        else
            print_error "Namespace é necessário para continuar"
            exit 1
        fi
    else
        print_info "Namespace $NAMESPACE encontrado"
    fi
}

# Verificar se as imagens foram configuradas
check_images() {
    print_info "Verificando se as imagens foram configuradas..."

    if grep -r "your-registry" *.yaml > /dev/null 2>&1; then
        print_error "Imagens ainda não foram configuradas!"
        print_warning "Edite os arquivos deployment e substitua 'your-registry' pelo seu registry real"
        print_warning "Exemplo: docker.io/youruser, gcr.io/project-id, etc."
        exit 1
    fi

    print_success "Imagens configuradas"
}

# Verificar se o secret foi configurado
check_secret() {
    print_info "Verificando configuração do secret..."

    if grep "your-project.supabase.co" 01-secret.yaml > /dev/null 2>&1; then
        print_error "Secret ainda não foi configurado!"
        print_warning "Edite 01-secret.yaml e configure:"
        print_warning "  - SUPABASE_URL"
        print_warning "  - SUPABASE_SERVICE_KEY"
        print_warning "  - SUPABASE_ANON_KEY"
        exit 1
    fi

    print_success "Secret configurado"
}

# Aplicar manifestos
apply_manifests() {
    print_info "Iniciando deploy do Archon..."

    check_kubectl
    check_namespace
    check_images
    check_secret

    print_info "Aplicando secret..."
    kubectl apply -f 01-secret.yaml

    print_info "Aplicando deployments..."
    kubectl apply -f 02-deployment-server.yaml
    kubectl apply -f 03-deployment-mcp.yaml
    kubectl apply -f 04-deployment-agents.yaml
    kubectl apply -f 05-deployment-frontend.yaml

    print_info "Aplicando services..."
    kubectl apply -f 06-service-server.yaml
    kubectl apply -f 07-service-mcp.yaml
    kubectl apply -f 08-service-agents.yaml
    kubectl apply -f 09-service-frontend.yaml

    print_info "Aplicando ingress..."
    kubectl apply -f 10-ingress.yaml

    print_success "Deploy concluído!"
    print_info "Aguarde alguns minutos para os pods iniciarem..."
    print_info "Execute './deploy.sh status' para verificar o status"
}

# Deletar recursos
delete_manifests() {
    print_warning "Isso irá remover TODOS os recursos do Archon"
    read -p "Tem certeza? (y/n) " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Operação cancelada"
        exit 0
    fi

    print_info "Removendo recursos do Archon..."

    kubectl delete -f 10-ingress.yaml --ignore-not-found=true
    kubectl delete -f 06-service-server.yaml --ignore-not-found=true
    kubectl delete -f 07-service-mcp.yaml --ignore-not-found=true
    kubectl delete -f 08-service-agents.yaml --ignore-not-found=true
    kubectl delete -f 09-service-frontend.yaml --ignore-not-found=true
    kubectl delete -f 02-deployment-server.yaml --ignore-not-found=true
    kubectl delete -f 03-deployment-mcp.yaml --ignore-not-found=true
    kubectl delete -f 04-deployment-agents.yaml --ignore-not-found=true
    kubectl delete -f 05-deployment-frontend.yaml --ignore-not-found=true
    kubectl delete -f 01-secret.yaml --ignore-not-found=true

    print_success "Recursos removidos"
}

# Verificar status
check_status() {
    check_kubectl

    print_info "Status dos Pods:"
    kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/instance=$APP_NAME" -o wide

    echo ""
    print_info "Status dos Services:"
    kubectl get svc -n "$NAMESPACE" -l "app.kubernetes.io/instance=$APP_NAME"

    echo ""
    print_info "Status do Ingress:"
    kubectl get ingress -n "$NAMESPACE" "$APP_NAME"

    echo ""
    print_info "Certificados TLS:"
    kubectl get certificate -n "$NAMESPACE"
}

# Ver logs
view_logs() {
    check_kubectl

    echo "Selecione o serviço:"
    echo "1) archon-server"
    echo "2) archon-mcp"
    echo "3) archon-agents"
    echo "4) archon-frontend"
    echo "5) Todos"
    read -p "Opção: " option

    case $option in
        1)
            print_info "Logs do archon-server:"
            kubectl logs -n "$NAMESPACE" -l "app.kubernetes.io/name=archon-server" --tail=100 -f
            ;;
        2)
            print_info "Logs do archon-mcp:"
            kubectl logs -n "$NAMESPACE" -l "app.kubernetes.io/name=archon-mcp" --tail=100 -f
            ;;
        3)
            print_info "Logs do archon-agents:"
            kubectl logs -n "$NAMESPACE" -l "app.kubernetes.io/name=archon-agents" --tail=100 -f
            ;;
        4)
            print_info "Logs do archon-frontend:"
            kubectl logs -n "$NAMESPACE" -l "app.kubernetes.io/name=archon-frontend" --tail=100 -f
            ;;
        5)
            print_info "Logs de todos os serviços:"
            kubectl logs -n "$NAMESPACE" -l "app.kubernetes.io/instance=$APP_NAME" --all-containers=true --tail=100 -f
            ;;
        *)
            print_error "Opção inválida"
            exit 1
            ;;
    esac
}

# Restart de serviços
restart_service() {
    check_kubectl

    echo "Selecione o serviço para restart:"
    echo "1) archon-server"
    echo "2) archon-mcp"
    echo "3) archon-agents"
    echo "4) archon-frontend"
    echo "5) Todos"
    read -p "Opção: " option

    case $option in
        1)
            kubectl rollout restart deployment/archon-server -n "$NAMESPACE"
            print_success "Restart do archon-server iniciado"
            ;;
        2)
            kubectl rollout restart deployment/archon-mcp -n "$NAMESPACE"
            print_success "Restart do archon-mcp iniciado"
            ;;
        3)
            kubectl rollout restart deployment/archon-agents -n "$NAMESPACE"
            print_success "Restart do archon-agents iniciado"
            ;;
        4)
            kubectl rollout restart deployment/archon-frontend -n "$NAMESPACE"
            print_success "Restart do archon-frontend iniciado"
            ;;
        5)
            kubectl rollout restart deployment -n "$NAMESPACE" -l "app.kubernetes.io/instance=$APP_NAME"
            print_success "Restart de todos os serviços iniciado"
            ;;
        *)
            print_error "Opção inválida"
            exit 1
            ;;
    esac
}

# Menu principal
case "${1:-help}" in
    apply)
        apply_manifests
        ;;
    delete)
        delete_manifests
        ;;
    status)
        check_status
        ;;
    logs)
        view_logs
        ;;
    restart)
        restart_service
        ;;
    help|*)
        echo "Uso: $0 {apply|delete|status|logs|restart}"
        echo ""
        echo "Comandos:"
        echo "  apply    - Aplica todos os manifestos (deploy completo)"
        echo "  delete   - Remove todos os recursos do Archon"
        echo "  status   - Verifica status dos recursos"
        echo "  logs     - Visualiza logs dos serviços"
        echo "  restart  - Reinicia um ou mais serviços"
        exit 0
        ;;
esac
