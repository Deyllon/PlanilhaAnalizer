# planilha-analizer

Serviço em `Node.js + TypeScript` para:

- ler múltiplas planilhas do Google Sheets
- monitorar a janela `hoje + 2 dias` em `America/Sao_Paulo`
- detectar transições de status por linha
- persistir o último estado observado
- enviar um resumo consolidado por WhatsApp

## Setup

1. Ajuste o arquivo [.env.example](/c:/Users/Plus_/Documents/projetos/planilha-analizer/.env.example) para `.env`.
2. Preencha as credenciais da Service Account do Google e do Twilio WhatsApp.
3. Edite [config/sheets.config.json](/c:/Users/Plus_/Documents/projetos/planilha-analizer/config/sheets.config.json) com os IDs e abas reais.
4. Compartilhe cada planilha com o e-mail da Service Account.

## Twilio WhatsApp

- O projeto usa a API REST da Twilio para envio de WhatsApp.
- Para testes com conta trial, use o Sandbox do WhatsApp da Twilio.
- No Sandbox, o remetente normalmente será `whatsapp:+14155238886` e o destinatário precisa entrar no sandbox com `join <code>`.
- Contas trial têm limite operacional e são adequadas para MVP/teste, não para produção contínua.

## Comandos

- `npm run job:once`
- `npm run job:dry-run`
- `npm run job:scheduler`
- `npm run job:preview-messages`
- `npm test`
- `npm run test:coverage`

## Observação

O adapter de persistência foi mantido com a interface `SqliteStorage`, mas nesta versão usa armazenamento em arquivo JSON local para evitar dependências externas e manter o projeto executável no ambiente atual
