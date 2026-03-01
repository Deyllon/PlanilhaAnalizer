---
name: sheets-whatsapp-ops
description: Agente para monitorar Google Sheets, detectar mudancas relevantes e enviar resumos operacionais por WhatsApp com foco em hoje + 2 dias.
---

## Contexto

Este projeto monitora uma ou mais planilhas do Google Sheets (IDs configuraveis), detecta mudancas de status em linhas relevantes e envia notificacoes operacionais por WhatsApp com foco no que ainda exige cobranca.

## Regras de negocio obrigatorias

### Janela de analise

- Sempre considerar **hoje + 2 dias** (3 dias corridos incluindo hoje), usando timezone `America/Sao_Paulo`.
- Ignorar linhas fora desse intervalo.

### Status e prioridade

- O foco principal nao e "Em producao".
- O que mais importa operacionalmente:
  - tudo que **nao esta agendado**
  - tudo que esta **pendente**
  - tudo que esta **aprovado e ainda nao agendado**
  - tudo que ainda **nao esta aprovado**

### Responsavel por status

- Sempre exibir o responsavel atual do conteudo quando houver.
- Regras padrao:
  - `Gravado` -> responsavel e Maju (configuravel)
  - `Em producao` -> depende do formato:
    - `Reels` -> Maju
    - `Estatico` ou `Carrossel` -> Elaine
  - `Em copy` -> Gustavo
  - `Em aprovacao` -> voce
  - `Aprovada` -> voce, ate virar `Agendada`

### Colunas relevantes

- `CODIGO`
- `PRAZO` (formato `02/03/2026 18:00:00`)
- `FORMATO` (`REELS`, `ESTATICO`, `CARROSEL`)
- `STATUS`
- `OBSERVACOES`

### Deteccao de mudancas

- O sistema deve persistir o ultimo status observado por linha (`sheetId + aba + rowKey`).
- Sempre que o status mudar, registrar o evento (`antigo -> novo`).
- Fora dos horarios fixos, so notificar no WhatsApp se houver mudanca de status relevante.

### Notificacao WhatsApp

- O job pode rodar com polling horario.
- Enviar no maximo 1 mensagem por execucao.
- **08h**: enviar relatorio de tudo no range `hoje + 2` que ainda **nao esta agendado**.
- **12h**: enviar relatorio das **mudancas de status do dia**.
- **19h**: enviar relatorio do **estado atual** no range `hoje + 2`, com:
  1. Pendentes
  2. Aprovados e ainda nao agendados
  3. Nao aprovados
- Fora desses horarios:
  - so enviar se houver mudancas novas de status que importam
  - se nao houver mudanca, nao enviar nada
- Cada slot fixo (`08h`, `12h`, `19h`) deve ser enviado no maximo uma vez por dia.

## Requisitos tecnicos

- Node.js + TypeScript.
- Integracao com Google Sheets via Service Account (preferencial) ou OAuth2.
- Cliente WhatsApp via Twilio WhatsApp API (credenciais via env).
- Persistencia minima para estado e deduplicacao de notificacoes.

## Requisitos nao funcionais

- Minimizar custo de envio para WhatsApp.
- Evitar mensagens redundantes; nao enviar toda hora sem necessidade.

## Twilio

- O provedor atual de WhatsApp deve ser Twilio.
- Para testes, o projeto pode usar o Twilio Sandbox for WhatsApp.
- No sandbox, o destinatario precisa entrar manualmente com o codigo `join`.
- Contas trial sao limitadas e servem para teste, nao para uso de producao continuo.
- Para envio proativo fora da janela de 24h, pode ser necessario template via Twilio Content API (`TWILIO_CONTENT_SID`).
