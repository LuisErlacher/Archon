#!/bin/bash

# Script para build e push das imagens Docker do Archon
# Uso: ./build-and-push.sh <registry> [version]
#
# Exemplos:
#   ./build-and-push.sh docker.io/youruser latest
#   ./build-and-push.sh gcr.io/project-id v1.0.0
#   ./build-and-push.sh registry.digitalocean.com/yourregistry latest

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar argumentos
if [ -z "$1" ]; then
    print_error "Registry não especificado"
    echo ""
    echo "Uso: $0 <registry> [version]"
    echo ""
    echo "Exemplos:"
    echo "  $0 docker.io/youruser latest"
    echo "  $0 gcr.io/project-id v1.0.0"
    echo "  $0 registry.digitalocean.com/yourregistry latest"
    exit 1
fi

REGISTRY="$1"
VERSION="${2:-latest}"

print_info "Registry: $REGISTRY"
print_info "Version: $VERSION"

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    print_error "Este script deve ser executado no diretório raiz do projeto Archon"
    exit 1
fi

# Função para build e push de uma imagem
build_and_push() {
    local service=$1
    local dockerfile=$2
    local context=$3
    local image_name="${REGISTRY}/archon-${service}:${VERSION}"

    print_info "Building $service..."
    docker build -t "$image_name" -f "$dockerfile" "$context"
    print_success "Build de $service concluído"

    print_info "Pushing $service..."
    docker push "$image_name"
    print_success "Push de $service concluído"

    echo ""
}

# Build e push de todas as imagens
print_info "Iniciando build e push de todas as imagens..."
echo ""

build_and_push "server" "python/Dockerfile.server" "python"
build_and_push "mcp" "python/Dockerfile.mcp" "python"
build_and_push "agents" "python/Dockerfile.agents" "python"
build_and_push "frontend" "archon-ui-main/Dockerfile" "archon-ui-main"

print_success "Todas as imagens foram construídas e enviadas com sucesso!"
echo ""
print_info "Imagens criadas:"
echo "  - ${REGISTRY}/archon-server:${VERSION}"
echo "  - ${REGISTRY}/archon-mcp:${VERSION}"
echo "  - ${REGISTRY}/archon-agents:${VERSION}"
echo "  - ${REGISTRY}/archon-frontend:${VERSION}"
echo ""
print_info "Próximos passos:"
echo "  1. Atualize os arquivos de deployment em k8s/ com o registry correto:"
echo "     sed -i 's|your-registry|${REGISTRY}|g' k8s/*-deployment-*.yaml"
echo ""
echo "  2. Se usou uma versão específica (não 'latest'), atualize também:"
echo "     sed -i 's|:latest|:${VERSION}|g' k8s/*-deployment-*.yaml"
echo ""
echo "  3. Configure o secret:"
echo "     vi k8s/01-secret.yaml"
echo ""
echo "  4. Aplique os manifestos:"
echo "     cd k8s && ./deploy.sh apply"
