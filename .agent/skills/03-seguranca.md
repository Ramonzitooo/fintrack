# 3. Engenharia Defensiva e Auditoria de Segurança (AppSec)

## Mitigações Arquiteturais contra OWASP Top 10 e Mobile Top 10

A defesa em profundidade (*defense-in-depth*) na conceção de sistemas modernos apoia-se no princípio de que nenhuma barreira perimétrica de cliente é confiável²². O OWASP Top 10 lista A01:2021 (Broken Access Control) como a principal vulnerabilidade na Web, exigindo que o controlo de acesso seja validado diretamente no motor de dados através de políticas declarativas, e não apenas por middleware de aplicação²². Contra injeções (A03:2021 Injection), o uso exclusivo de consultas parametrizadas com vinculação forte de tipos é mandatório, tornando nula a eficácia de vetores de SQL Injection (SQLi)²⁴. Vetores de Cross-Site Scripting (XSS) e Cross-Site Request Forgery (CSRF) são mitigados pela orquestração conjunta de esquemas de higienização de dados em tempo de execução, cabeçalhos de Content Security Policy (`CSP: default-src 'self'`) e gestão de sessões baseada em cookies restritivos (`HttpOnly; Secure; SameSite=Strict`).

No ecossistema móvel (OWASP Mobile Top 10), as falhas mais críticas residem no uso incorreto de credenciais (M1) e armazenamento inseguro de dados confidenciais (M9). A persistência de tokens JWT ou chaves de cifra em contentores desprotegidos — como UserDefaults no iOS ou SharedPreferences em Android — expõe as credenciais a acessos não autorizados e ferramentas de extração em dispositivos com jailbreak ou root. No iOS, credenciais confidenciais devem ser delegadas ao Keychain Services utilizando a classe `kSecClassGenericPassword` e proteção `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`. No Android, os dados confidenciais requerem a API `EncryptedSharedPreferences`, ancorada no Android Keystore Provider com chaves AES-256-GCM geridas por hardware dedicado (TEE/StrongBox). Em aplicações Web em página única (SPA), o armazenamento em `localStorage` ou `sessionStorage` é vedado para tokens de sessão, transferindo-se essa guarda para cookies criptografados mantidos em canais HTTP restritos.

A integração direta entre aplicações Web e motores PostgreSQL através de camadas como o Supabase expõe a totalidade dos dados caso a funcionalidade de Row-Level Security (RLS) não seja ativada de forma proativa²². Cada tabela do esquema público deve receber obrigatoriamente `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` acompanhado por `FORCE ROW LEVEL SECURITY`²². No desenho das políticas SQL, o uso ingénuo da chamada direta `auth.uid() = user_id` degrada criticamente a taxa de processamento, pois força o planeador de consultas a reavaliar a função volátil para cada tupla examinada na tabela²². A sintaxe canónica exige o isolamento por subseleção escalar: `((select auth.uid()) = user_id)`, permitindo ao PostgreSQL avaliar a identidade uma única vez por consulta (*InitPlan*), reutilizando o resultado em cache de memória²². A segregação semântica entre as cláusulas `USING` (validação de leitura e registos preexistentes) e `WITH CHECK` (auditoria do novo estado inserido ou atualizado) previne que utilizadores alterem o vínculo de posse dos seus próprios registos²².

---

## Tabela de Parâmetros e Tokens Obrigatórios

| Domínio de Segurança | Mecanismo Normativo | Implementação Obrigatória | Risco Mitigado Principal |
| :--- | :--- | :--- | :--- |
| **PostgreSQL RLS** | Habilitação de Tabela | `ALTER TABLE t ENABLE ROW LEVEL SECURITY;` | Acesso não autorizado a linhas da tabela (A01)²⁶. |
| **PostgreSQL RLS** | Otimização de Identidade | `((select auth.uid()) = owner_id)` | Esgotamento de recursos / CPU em varreduras sequenciais²⁶. |
| **Supabase Grants** | Revogação de Acesso | `REVOKE ALL ON TABLE t FROM anon;` | Exposição acidental de endpoints a visitantes anónimos²². |
| **Armazenamento Web** | Sessão de Utilizador | `Cookie: HttpOnly; Secure; SameSite=Strict` | Roubo de credenciais via XSS e requisições CSRF. |
| **Armazenamento iOS** | Chaves e Tokens | `kSecClassGenericPassword` via Keychain | Extração estática de sessão do dispositivo (M9). |
| **Armazenamento Android** | Chaves e Tokens | `EncryptedSharedPreferences (MasterKey AES-256)` | Leitura indevida do sistema de ficheiros local (M9). |
| **Cabeçalho Web** | Política de Conteúdo | `Content-Security-Policy: default-src 'self'` | Execução de scripts injetados e XSS baseado em DOM. |
| **Higienização de Entrada** | Validação de Esquema | Esquema estrito em tempo de execução (ex.: Zod/Valibot) | Injeção de dados malformados e poluição de protótipos. |

---

## Checklist Booleano de Validação

- [ ] **PASS**: A instrução `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` é executada em todas as tabelas criadas no esquema `public`²⁶.
- [ ] **PASS**: Todas as políticas de acesso em PostgreSQL/Supabase isolam as funções de utilizador com subseleção `(select auth.uid())`²⁶.
- [ ] **PASS**: A tabela possui índices compostos explícitos para as colunas auditadas em políticas RLS (ex.: `CREATE INDEX ON public.items (user_id);`)²⁸.
- [ ] **PASS**: A validação de payloads com Zod rejeita chaves adicionais não mapeadas através do modificador estrito `.strict()`.
- [ ] **FAIL**: Interpolar ou concatenar strings diretamente em blocos de comandos SQL executados pela aplicação (ex.: `` `SELECT * FROM users WHERE id = '${id}'` ``)²⁴.
- [ ] **FAIL**: Distribuir a chave secreta `service_role` em variáveis de ambiente acessíveis pelo navegador ou pela aplicação móvel²².
- [ ] **FAIL**: Armazenar tokens de autenticação ou chaves de API sensíveis em `window.localStorage` ou `sessionStorage`.
- [ ] **FAIL**: Configurar uma política de RLS com a diretiva `USING (true)` para operações de `INSERT`, `UPDATE` ou `DELETE` sem restrição de contexto.

---

## Lista de Links Oficiais Canónicos

- [OWASP Top 10:2021 - Relatório Oficial](https://owasp.org/Top10/)
- [OWASP Mobile Top 10 (2024)](https://owasp.org/www-project-mobile-top-10/)
- [PostgreSQL Documentation - Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Documentation - Guia de Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [OWASP Cheat Sheet Series - Prevenção de Injeção de SQL](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

---

## Exemplo de Código Mínimo Ideal

### SQL (PostgreSQL / Supabase RLS Defensivo com InitPlan Otimizado)

```sql
-- 1. Criação da tabela no esquema público
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexação mandatória para desempenho de verificação da política RLS
CREATE INDEX idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX idx_projects_org_id ON public.projects(organization_id);

-- 3. Habilitação incondicional e forçada de RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

-- 4. Restrição de permissões base ao perfil anon
REVOKE ALL ON TABLE public.projects FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;

-- 5. Política de Leitura (SELECT): Otimização via subseleção escalar de identidade
CREATE POLICY "Utilizadores autenticados acedem aos seus próprios projetos"
ON public.projects
FOR SELECT
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
);

-- 6. Política de Inserção (INSERT): Validação de autoria estrita
CREATE POLICY "Utilizadores autenticados criam projetos vinculados a si mesmos"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = (SELECT auth.uid())
);

-- 7. Política de Alteração (UPDATE): Restrição de seleção e integridade posterior
CREATE POLICY "Utilizadores autenticados atualizam unicamente os seus projetos"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
)
WITH CHECK (
  owner_id = (SELECT auth.uid())
);

-- 8. Política de Eliminação (DELETE)
CREATE POLICY "Utilizadores autenticados eliminam apenas os seus projetos"
ON public.projects
FOR DELETE
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
);
```
