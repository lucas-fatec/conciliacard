# ConciliaCard — Conciliação de Extrato de Cartão de Crédito

Projeto acadêmico da disciplina **Laboratório de Engenharia de Software** — FATEC Ipiranga / Centro Paula Souza
Prof. Veríssimo · Semestre 2026/2 · **Entrega da Sprint #1**

> **Aviso:** os extratos utilizados são **fictícios**, gerados pelo script `samples/gerar_extrato.py`.
> O sistema não se conecta a nenhuma instituição financeira e não processa dados reais de cartão.

## O que o sistema faz

O usuário registra seus gastos ao longo do mês. Quando a fatura fecha, ele importa o extrato do
cartão em PDF. O sistema compara os dois lados e classifica cada linha:

| Situação | Significado |
|---|---|
| **Conciliado** | Valor idêntico e diferença de datas de até 3 dias |
| **Valor divergente** | Descrições semelhantes, valores diferentes |
| **Não cadastrado** | Está no extrato, mas o usuário não registrou |
| **Não faturado** | O usuário registrou, mas ainda não foi cobrado |

## Casos de uso entregues na Sprint #1

| Código | Caso de Uso | Endpoints |
|---|---|---|
| UC01 | Autenticação de Usuário | `POST /api/auth/cadastro`, `POST /api/auth/login` |
| UC02 | Manter Lançamentos de Gastos | `GET/POST/PUT/DELETE /api/gastos` |
| UC03 | Importar Extrato do Cartão (PDF) | `POST /api/extratos`, `GET /api/extratos` |
| UC04 | Conciliar Extrato | `GET /api/conciliacao/:extratoId` |

## Arquitetura

```
Navegador  ──►  frontend-conciliacard (Nginx :8080)
                        │  proxy /api/
                        ▼
                backend-conciliacard (Node.js 18 + Express :3000)
                        │  SQL
                        ▼
                 db-conciliacard (MySQL 8.0 :3306)
```

O Nginx faz proxy de `/api/` para a API, o que elimina problemas de CORS e evita endereço
fixo no JavaScript.

## Estrutura do repositório

```
.
├── docker-compose.yml          # orquestração dos 3 serviços
├── README.md
├── bd/
│   ├── Dockerfile              # imagem do MySQL
│   └── init.sql                # tabelas + massa de dados de teste
├── backend/
│   ├── Dockerfile              # imagem da API
│   ├── package.json
│   ├── src/
│   │   ├── index.js            # rotas da API
│   │   ├── auth.js             # UC01 — autenticação e política de senha
│   │   ├── db.js               # pool MySQL + espera pelo banco
│   │   ├── pdfTexto.js         # extração de texto do PDF
│   │   ├── parserExtrato.js    # UC03 — texto → lançamentos (módulo puro)
│   │   └── conciliador.js      # UC04 — regras RN-01 a RN-05 (módulo puro)
│   └── tests/                  # 24 testes automatizados (Jest)
├── frontend/
│   ├── Dockerfile              # imagem do Nginx
│   ├── nginx.conf
│   ├── index.html              # tela de login/cadastro
│   ├── app.html                # painel
│   ├── script.js
│   └── style.css
├── samples/
│   ├── gerar_extrato.py        # gera os extratos fictícios
│   ├── extrato_setembro_2026.pdf
│   └── extrato_invalido_sem_lancamentos.pdf
├── prototipo/
│   └── Prototipo_ConciliaCard.html
```

## Como executar

Pré-requisitos: **Docker Desktop** em execução; portas 3306, 3000 e 8080 livres.

```bash
docker compose up -d       # sobe os 3 contêineres
docker compose ps          # confirma status Up / Healthy
```

Acesse **http://localhost:8080** e entre com:

| Campo | Valor |
|---|---|
| E-mail | `usuario@fatec.sp.gov.br` |
| Senha | `Senha@2026` |

Depois importe `samples/extrato_setembro_2026.pdf` e clique em **Conciliar**.

Para parar e limpar tudo (inclusive o banco, para recomeçar do zero):

```bash
docker compose down -v
```

### Executar os testes automatizados

```bash
cd backend
npm install
npm test
```

Resultado esperado: **4 suítes, 24 testes, todos aprovados**.

### Regerar os extratos fictícios

```bash
cd samples
pip install reportlab
python3 gerar_extrato.py
```

```bash
docker compose down -v
docker rmi -f $(docker images -q)     # limpa o cache local
docker compose up -d                  # deve baixar as imagens do Docker Hub
```

## Variáveis de ambiente do backend

| Variável | Padrão | Descrição |
|---|---|---|
| `DB_HOST` | `db-conciliacard` | host do MySQL (use `localhost` fora do Docker) |
| `DB_USER` / `DB_PASSWORD` | `root` / `root` | credenciais do banco |
| `DB_NAME` | `conciliacard` | nome do banco |
| `JWT_SECRET` | `conciliacard-sprint1-fatec` | chave de assinatura do token |
| `PORT` | `3000` | porta da API |

## Formato de extrato aceito (UC03)

Cada lançamento deve estar em uma linha, no padrão:

```
05/09/2026   UBER TRIP SAO PAULO          R$ 27,90
```

Data `dd/mm/aaaa`, descrição e valor em formato brasileiro. O prefixo `R$` é opcional.
Linhas com valor negativo (pagamentos e créditos) são ignoradas, assim como qualquer
linha que não siga o padrão.

