# 4. Data Models and Schema Changes

## 4.1 New Data Models

### User Model (Managed by Supabase Auth)

**Purpose:** Armazena informações de autenticação de usuários
**Integration:** Supabase Auth cria automaticamente a tabela `auth.users` - não precisamos gerenciar

**Key Attributes:**
- `id`: UUID - Primary key (gerado por Supabase)
- `email`: TEXT - Email único do usuário
- `encrypted_password`: TEXT - Password hash (gerenciado por Supabase)
- `email_confirmed_at`: TIMESTAMP - Timestamp de confirmação de email
- `created_at`: TIMESTAMP - Data de criação da conta
- `updated_at`: TIMESTAMP - Última atualização

**Relationships:**
- **With Existing:** `user_id` columns em tables existentes referenciarão `auth.users.id`
- **With New:** Nenhuma nova tabela além das fornecidas por Supabase Auth

## 4.2 Schema Integration Strategy

**Database Changes Required:**

### New Columns Added to Existing Tables

```sql
-- archon_projects table
ALTER TABLE archon_projects
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- archon_tasks table
ALTER TABLE archon_tasks
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- archon_sources table (knowledge base sources)
ALTER TABLE archon_sources
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- archon_crawled_pages table
ALTER TABLE archon_crawled_pages
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- archon_code_examples table
ALTER TABLE archon_code_examples
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
```

**Key Design Decisions:**
- ✅ **Nullable columns:** Permite dados existentes (user_id=NULL) sem migração complexa
- ✅ **ON DELETE SET NULL:** Se user deletado, dados ficam órfãos mas não são removidos
- ✅ **Foreign key constraint:** Garante integridade referencial quando user_id presente

### New Indexes for Performance

```sql
-- Index para queries "meus projetos"
CREATE INDEX idx_projects_user_id ON archon_projects(user_id) WHERE user_id IS NOT NULL;

-- Index para queries "minhas tasks"
CREATE INDEX idx_tasks_user_id ON archon_tasks(user_id) WHERE user_id IS NOT NULL;

-- Index para queries "minhas sources"
CREATE INDEX idx_sources_user_id ON archon_sources(user_id) WHERE user_id IS NOT NULL;
```

**Performance Impact:** Queries com `WHERE user_id = $1` serão otimizadas via index, <10ms overhead.

### Updated RLS Policies

```sql
-- Projects table RLS
DROP POLICY IF EXISTS "Users can view all projects" ON archon_projects;

CREATE POLICY "users_own_projects" ON archon_projects
  FOR ALL USING (
    -- Permite acesso sem auth (backward compatibility)
    auth.uid() IS NULL
    -- Ou user é dono do projeto
    OR auth.uid() = user_id
    -- Ou é service_role key (MCP, agents)
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- Tasks table RLS
DROP POLICY IF EXISTS "Users can view all tasks" ON archon_tasks;

CREATE POLICY "users_own_tasks" ON archon_tasks
  FOR ALL USING (
    auth.uid() IS NULL
    OR auth.uid() = user_id
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- Sources table RLS (similar pattern)
CREATE POLICY "users_own_sources" ON archon_sources
  FOR ALL USING (
    auth.uid() IS NULL
    OR auth.uid() = user_id
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );
```

### Migration Strategy

**Backward Compatibility Measures:**

1. **Existing Data Preservation:**
   - Todos dados existentes mantêm `user_id = NULL`
   - RLS policies permitem acesso a dados com `user_id = NULL` quando `auth.uid() IS NULL`
   - Zero data loss ou corruption

2. **Service-Key Access:**
   - Requests com `SUPABASE_SERVICE_KEY` set `current_setting('request.jwt.claim.role') = 'service_role'`
   - RLS policies bypassam user_id check para service_role
   - MCP server e agents mantêm acesso total

3. **Rollback Plan:**
   ```sql
   -- Rollback migration (se necessário)
   ALTER TABLE archon_projects DROP COLUMN user_id;
   ALTER TABLE archon_tasks DROP COLUMN user_id;
   ALTER TABLE archon_sources DROP COLUMN user_id;
   -- Restaura RLS policies antigas
   ```

---
