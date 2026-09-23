# Esteira de Crédito — Integração Score + Decisão

## Arquitetura

O projeto foi reorganizado para demonstrar dois microsserviços independentes:

```text
                    HTTP POST
Score Engine  ───────────────────>  Decisão
   :8080                              :8081
     │                                   │
     └── calcula score                   └── aplica política
                                         │
                          APROVADO / ANALISE_MANUAL / REPROVADO
```

O Score recebe os dados necessários para o cálculo. A Decisão não repete essa coleta: recebe o resultado consolidado do Score.

## Execução local no mesmo notebook

O cenário de dois computadores é simulado usando portas diferentes no mesmo notebook:

```text
Score:    http://localhost:8080
Decisão:  http://localhost:8081
```

A comunicação entre eles continua sendo feita por HTTP, portanto o teste representa a separação dos serviços. Em computadores diferentes, basta alterar a URL da Decisão no ambiente do Score.

## Pastas

```text
Score-Engine/   → Java + Spring Boot + PostgreSQL
Decisao/        → Node.js + HTTP + interface web
```

## Contrato principal

Score recebe:

```text
POST /api/v1/score/evaluate
```

Score envia para:

```text
POST /api/v1/decisao
```

Decisão disponibiliza:

```text
GET /api/v1/decisao/latest
GET /api/v1/decisao/health
```

## Responsabilidades

**Score:** calcular score, faixa de risco, PD e fatores/componentes de explicação.

**Decisão:** receber o resultado e aplicar a política de decisão.

Princípio: **Score calcula. Decisão decide.**
