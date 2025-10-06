#!/bin/bash
# Script para fazer push de todas as imagens Docker do Archon
# Uso: ./push-images.sh [registry] [version]
# Exemplo: ./push-images.sh docker.io/seu-usuario v1.0.0

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${BLUE}[PUSH]${NC} $1"
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
REGISTRY="${1}"
if [ -z "$REGISTRY" ]; then
    error "Registry não fornecido!"
    echo ""
    echo "Uso: ./push-images.sh [registry] [version]"
    echo "Exemplo: ./push-images.sh docker.io/seu-usuario v1.0.0"
    exit 1
fi

# Tag/versão da imagem
VERSION="${2:-latest}"
log "Registry: $REGISTRY"
log "Versão: $VERSION"

echo ""
echo "=========================================="
echo "  PUSH DE IMAGENS DOCKER - ARCHON"
echo "=========================================="
echo ""

# Fazer login no registry (se necessário)
if [[ "$REGISTRY" != "localhost"* ]]; then
    warning "Certifique-se de estar logado no registry:"
    echo "  docker login $REGISTRY"
    echo ""
    read -p "Pressione ENTER para continuar ou CTRL+C para cancelar..."
fi

# =============================================================================
# PUSH DAS IMAGENS
# =============================================================================

log "1/4 - Pushing archon-server:${VERSION}..."
docker push "${REGISTRY}/archon-server:${VERSION}"
if [ "$VERSION" != "latest" ]; then
    docker push "${REGISTRY}/archon-server:latest"
fi
success "archon-server pushed"
echo ""

log "2/4 - Pushing archon-mcp:${VERSION}..."
docker push "${REGISTRY}/archon-mcp:${VERSION}"
if [ "$VERSION" != "latest" ]; then
    docker push "${REGISTRY}/archon-mcp:latest"
fi
success "archon-mcp pushed"
echo ""

log "3/4 - Pushing archon-agents:${VERSION}..."
docker push "${REGISTRY}/archon-agents:${VERSION}"
if [ "$VERSION" != "latest" ]; then
    docker push "${REGISTRY}/archon-agents:latest"
fi
success "archon-agents pushed"
echo ""

log "4/4 - Pushing archon-frontend:${VERSION}..."
docker push "${REGISTRY}/archon-frontend:${VERSION}"
if [ "$VERSION" != "latest" ]; then
    docker push "${REGISTRY}/archon-frontend:latest"
fi
success "archon-frontend pushed"
echo ""

# =============================================================================
# RESUMO
# =============================================================================
echo ""
echo "=========================================="
echo "  PUSH COMPLETO!"
echo "=========================================="
echo ""
echo "Imagens disponíveis no registry:"
echo "  - ${REGISTRY}/archon-server:${VERSION}"
echo "  - ${REGISTRY}/archon-mcp:${VERSION}"
echo "  - ${REGISTRY}/archon-agents:${VERSION}"
echo "  - ${REGISTRY}/archon-frontend:${VERSION}"
echo ""

success "Todas as imagens foram enviadas com sucesso!"

echo ""
echo "=========================================="
echo "  PRÓXIMO PASSO: DEPLOY NO KUBERNETES"
echo "=========================================="
echo ""
echo "1. Edite k8s-manifests-complete.yaml"
echo "2. Substitua 'seu-registry' por '${REGISTRY}'"
echo "3. Adicione seus secrets (SUPABASE_URL, SUPABASE_SERVICE_KEY, etc)"
echo "4. Execute: kubectl apply -f k8s-manifests-complete.yaml"
echo ""
