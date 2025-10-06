#!/bin/bash
# Script para build de todas as imagens Docker do Archon para Kubernetes
# Uso: ./build-images.sh [registry]
# Exemplo: ./build-images.sh docker.io/seu-usuario

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${BLUE}[BUILD]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar se registry foi fornecido
REGISTRY="${1:-localhost:5000}"
if [ "$REGISTRY" = "localhost:5000" ]; then
    warning "Usando registry local: $REGISTRY"
    warning "Para usar um registry remoto, execute: ./build-images.sh docker.io/seu-usuario"
else
    log "Usando registry: $REGISTRY"
fi

# Tag/versão da imagem
VERSION="${2:-latest}"
log "Versão das imagens: $VERSION"

# Diretório raiz do projeto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log "Diretório do projeto: $PROJECT_ROOT"

echo ""
echo "=========================================="
echo "  BUILD DE IMAGENS DOCKER - ARCHON"
echo "=========================================="
echo ""

# =============================================================================
# 1. BUILD - ARCHON SERVER
# =============================================================================
log "1/4 - Building archon-server..."
cd "$PROJECT_ROOT/python"

docker build \
    -f Dockerfile.server \
    -t "${REGISTRY}/archon-server:${VERSION}" \
    -t "${REGISTRY}/archon-server:latest" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    .

success "archon-server built successfully"
echo ""

# =============================================================================
# 2. BUILD - ARCHON MCP
# =============================================================================
log "2/4 - Building archon-mcp..."
cd "$PROJECT_ROOT/python"

docker build \
    -f Dockerfile.mcp \
    -t "${REGISTRY}/archon-mcp:${VERSION}" \
    -t "${REGISTRY}/archon-mcp:latest" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    .

success "archon-mcp built successfully"
echo ""

# =============================================================================
# 3. BUILD - ARCHON AGENTS (opcional)
# =============================================================================
log "3/4 - Building archon-agents..."
cd "$PROJECT_ROOT/python"

docker build \
    -f Dockerfile.agents \
    -t "${REGISTRY}/archon-agents:${VERSION}" \
    -t "${REGISTRY}/archon-agents:latest" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    .

success "archon-agents built successfully"
echo ""

# =============================================================================
# 4. BUILD - ARCHON FRONTEND
# =============================================================================
log "4/4 - Building archon-frontend..."
cd "$PROJECT_ROOT/archon-ui-main"

docker build \
    -f Dockerfile.production \
    -t "${REGISTRY}/archon-frontend:${VERSION}" \
    -t "${REGISTRY}/archon-frontend:latest" \
    .

success "archon-frontend built successfully"
echo ""

# =============================================================================
# RESUMO
# =============================================================================
echo ""
echo "=========================================="
echo "  BUILD COMPLETO!"
echo "=========================================="
echo ""
echo "Imagens criadas:"
echo "  - ${REGISTRY}/archon-server:${VERSION}"
echo "  - ${REGISTRY}/archon-mcp:${VERSION}"
echo "  - ${REGISTRY}/archon-agents:${VERSION}"
echo "  - ${REGISTRY}/archon-frontend:${VERSION}"
echo ""

# Listar imagens
log "Verificando imagens criadas..."
docker images | grep archon | grep "${VERSION}"

echo ""
echo "=========================================="
echo "  PRÓXIMOS PASSOS"
echo "=========================================="
echo ""
echo "1. Para fazer PUSH das imagens para o registry:"
echo "   docker push ${REGISTRY}/archon-server:${VERSION}"
echo "   docker push ${REGISTRY}/archon-mcp:${VERSION}"
echo "   docker push ${REGISTRY}/archon-agents:${VERSION}"
echo "   docker push ${REGISTRY}/archon-frontend:${VERSION}"
echo ""
echo "   OU use o script: ./push-images.sh ${REGISTRY} ${VERSION}"
echo ""
echo "2. Para testar localmente:"
echo "   docker-compose -f docker-compose.yml up -d"
echo ""
echo "3. Para fazer deploy no Kubernetes:"
echo "   - Edite k8s-manifests-complete.yaml"
echo "   - Substitua 'seu-registry' por '${REGISTRY}'"
echo "   - Execute: kubectl apply -f k8s-manifests-complete.yaml"
echo ""

success "Todas as imagens foram construídas com sucesso!"
