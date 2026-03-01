---
name: tdd-quality-gates
description: Convenções de código e qualidade: TDD, cobertura mínima 80%, integração, hooks e CI antes de PR.
---

## Objetivo

Manter um padrão consistente de qualidade no projeto com foco em TDD, testes automatizados (unitários e integração), cobertura mínima e checks antes de enviar código para PR.

## Regras obrigatórias (Quality Gates)

### 1) Fluxo TDD (sempre que possível)

Siga o ciclo:

1. **Red**: escreva um teste que falha descrevendo o comportamento desejado.
2. **Green**: implemente o mínimo para passar.
3. **Refactor**: refatore mantendo os testes verdes.

**Proibido**: implementar feature sem teste quando o comportamento é testável.

### 2) Cobertura mínima

- O projeto deve manter **>= 80% de cobertura** como requisito mínimo.
- Prefira exigir cobertura **global e por arquivo** quando viável (evita “compensar” baixa cobertura em áreas críticas).
- Se algum trecho não for testável (ex.: integração com serviço externo), documente e isole via adapters/mocks.

Ao alterar código existente, **a cobertura não pode cair**.

### 3) Testes de integração são parte do padrão

- Toda feature que integra com I/O (DB, filas, HTTP, filesystem, cache, etc.) deve ter **pelo menos 1 teste de integração** cobrindo o caminho principal.
- Integração deve validar:
  - contrato de endpoints/handlers
  - persistência/queries essenciais
  - erros relevantes e casos de borda
- Quando fizer sentido, use:
  - containers (ex.: Testcontainers) OU
  - mocks/stubs de serviços externos, mas mantendo integração real do seu domínio.

### 4) Antes de PR: hook obrigatório

Antes de abrir PR (ou antes de subir branch), é obrigatório rodar automaticamente:

- testes (unit + integração)
- cobertura mínima
- (se existir) lint/format

Implementação recomendada: **Git hooks com Husky**:

- `pre-push`: roda `npm test` (inclui integração) + check de cobertura
- opcional `pre-commit`: roda lint/format rápido (ex.: lint-staged)

**Regra**: nunca desabilitar hook para “passar rápido”. Se estiver lento, otimize o setup (split de suites, cache, paralelismo), mas mantenha o gate.

### 5) CI deve reforçar (não confiar só no hook)

Todo PR deve ter CI que rode:

- `npm ci`
- `npm run lint` (se existir)
- `npm test` com cobertura >= 80%

O hook é uma proteção local; o CI é a proteção definitiva.

## Convenções de implementação

### Estrutura de testes

- Separe unit e integração, por exemplo:
  - `tests/unit/**`
  - `tests/integration/**`
  - ou `src/**/__tests__` + tag/grep para distinguir suites
- Nomeie testes pelo comportamento:
  - `should return 404 when user does not exist`
  - `creates order and persists items atomically`

### Princípios de design para testabilidade

- Prefira funções puras e injeção de dependências (adapters) para I/O.
- Não acople regras de negócio diretamente a frameworks (Express/Fastify/ORM). Use camadas:
  - `domain` (regras)
  - `services/use-cases`
  - `adapters` (db/http)
- Mocks apenas no necessário; integração para fluxos reais.

## Checklist obrigatório antes de concluir qualquer mudança

- [ ] Existem testes novos para a mudança (TDD).
- [ ] Existe teste de integração quando houve alteração em I/O.
- [ ] `npm test` passa localmente.
- [ ] Cobertura >= 80%.
- [ ] Hooks configurados (husky) ou documentado por que ainda não.
- [ ] CI permanece verde.

## Se faltar infraestrutura no projeto

Quando o repositório ainda não tiver isso configurado, faça as seguintes mudanças como parte do trabalho:

1. Adicionar scripts no `package.json`:
   - `test`
   - `test:unit` e `test:integration` (recomendado)
   - `test:coverage` (recomendado)
2. Configurar ferramenta de teste (ex.: Jest/Vitest) com coleta de cobertura.
3. Configurar Husky:
   - `pre-push` rodando `npm run test:coverage` (ou equivalente)
4. Configurar CI (GitHub Actions) com os mesmos gates.
