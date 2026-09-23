# Esteira de Crédito — Score + Decisão

Projeto acadêmico da Esteira de Crédito, com integração entre os módulos **Score** e **Decisão**.

## Arquitetura atual

```text
Score Engine :8080
      |
      | HTTP POST
      v
Decisão :8081
      |
      v
Resultado da decisão / auditoria
```

O Score calcula o resultado. A Decisão recebe esse resultado e aplica a lógica correspondente.

---

## 1. Estrutura

```text
/
├── Score-Engine/
│   ├── pom.xml
│   └── src/
├── Decisao/
│   ├── server.js
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── src/
└── README.md
```

### Responsabilidades

**Score**
- receber os dados necessários;
- calcular o score;
- classificar o risco;
- enviar o resultado para a Decisão.

**Decisão**
- receber o resultado do Score;
- processar a decisão;
- disponibilizar o resultado para consulta e auditoria.

---

## 2. Pré-requisitos

Verifique se a máquina possui:

- Java;
- Node.js;
- PostgreSQL para o Score;
- VS Code recomendado para executar o projeto Java.

Verificar Java:

```powershell
java -version
javac -version
```

Verificar Node.js:

```powershell
node -v
```

O Score utiliza PostgreSQL localmente por padrão:

```text
Host: localhost
Porta: 5432
Banco: score_engine_db
Usuário: postgres
```

Os valores podem ser alterados pelas variáveis de ambiente utilizadas no `application.yml`.

> Este README não inclui configuração global do Maven. O Score deve ser executado como aplicação Java/Spring Boot pelo ambiente de desenvolvimento no VS Code.

---

## 3. Executar a Decisão

Entre na pasta:

```powershell
cd Decisao
```

Inicie o serviço:

```powershell
node server.js
```

A saída deverá indicar a porta 8081, por exemplo:

```text
[DECISAO] Serviço iniciado em http://localhost:8081
[DECISAO] Recebendo Score em POST /api/v1/decisao
```

Mantenha esse terminal aberto.

Abra no navegador:

```text
http://localhost:8081
```

---

## 4. Verificar a Decisão

Health check:

```text
http://localhost:8081/api/v1/decisao/health
```

Consulta do último resultado:

```text
http://localhost:8081/api/v1/decisao/latest
```

---

## 5. Executar o Score

Abra a pasta `Score-Engine` no VS Code.

Abra:

```text
ScoreEngineApplication.java
```

Execute a aplicação pelo suporte Java/Spring Boot do VS Code.

**Não execute o arquivo Java diretamente pelo Code Runner.**

O Score deverá ficar disponível na porta:

```text
http://localhost:8080
```

---

## 6. Configuração da comunicação

O `application.yml` do Score utiliza, por padrão:

```text
Score:
http://localhost:8080

Decisão:
http://localhost:8081
```

O endereço da Decisão pode ser alterado pela variável:

```text
DECISION_URL
```

Valor padrão:

```text
http://localhost:8081
```

---

## 7. Ordem recomendada

1. Inicie o PostgreSQL.
2. Inicie a Decisão.
3. Inicie o Score.
4. Envie uma avaliação para o Score.
5. O Score calcula o resultado.
6. O Score envia o resultado para a Decisão por POST.
7. A Decisão processa o resultado.

Fluxo:

```text
Dados do cliente
      ↓
Score
      ↓
POST /api/v1/score/evaluate
      ↓
Resultado calculado
      ↓
POST /api/v1/decisao
      ↓
Decisão
      ↓
Resultado / auditoria
```

---

## 8. Endpoint do Score

Endpoint principal:

```text
POST /api/v1/score/evaluate
```

URL local:

```text
http://localhost:8080/api/v1/score/evaluate
```

Exemplo de payload:

```json
{
  "tipoPessoa": "PF",
  "forcarRecalculo": true,
  "perfilPF": {
    "cpf": "11122233344",
    "rendaMensal": 1000,
    "dividaTotal": 25000,
    "idade": 19,
    "estadoCivil": "SOLTEIRO",
    "numeroDependentes": 5,
    "diasAtrasoUltimos12Meses": 365,
    "limiteRotativoUtilizado": 4000,
    "limiteRotativoTotal": 4000,
    "mesesNoEmpregoAtual": 1,
    "mesesRelacionamentoBanco": 1
  }
}
```

Esse exemplo representa um cenário deliberadamente muito ruim para testes.

---

## 9. Endpoint da Decisão

A Decisão recebe o resultado do Score em:

```text
POST /api/v1/decisao
```

URL local:

```text
http://localhost:8081/api/v1/decisao
```

A Decisão não deve exigir o preenchimento manual dos dados que já foram produzidos pelo Score.

---

## 10. Testar a Decisão isoladamente

Também é possível enviar diretamente um resultado para a Decisão, sem executar o Score:

```powershell
$body = @{
    clienteId = "TESTE-001"
    tipoPessoa = "PF"
    scoreFinal = 120
    faixaRisco = "MUITO_RUIM"
    probabilidadeDefault = 0.85
    modelo = @{
        codigo = "SCORE_PF"
        versao = "v1.1.0"
    }
    calculatedAt = (Get-Date).ToUniversalTime().ToString("o")
    origem = "CALCULO"
    componentes = @()
    fatoresImpacto = @(
        "Histórico de pagamento muito ruim.",
        "Alta probabilidade de inadimplência.",
        "Baixa capacidade de pagamento."
    )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
    -Uri "http://localhost:8081/api/v1/decisao" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

Depois, consulte:

```text
http://localhost:8081/api/v1/decisao/latest
```

---

## 11. Execução em computadores diferentes

Os serviços também podem ficar em máquinas diferentes.

Exemplo:

```text
Máquina A
Decisão
192.168.0.10:8081

Máquina B
Score
192.168.0.20:8080
```

Nesse caso, o Score deve utilizar:

```text
http://192.168.0.10:8081
```

O IP na URL é o IP da máquina que **recebe** a requisição.

Portanto:

```text
Score → Decisão
```

usa o IP da máquina da **Decisão**.

---

## 12. Problemas comuns

### Decisão não inicia

Verifique:

```powershell
node -v
```

Depois:

```powershell
cd Decisao
node server.js
```

### A página abre, mas o CSS não aparece

Confirme a existência de:

```text
index.html
styles.css
script.js
```

O `server.js` disponibiliza esses arquivos.

### O POST aparece no terminal, mas a interface não atualiza

Consulte:

```text
http://localhost:8081/api/v1/decisao/latest
```

Se houver um resultado, a Decisão recebeu o POST.

### Score não inicia por problema no banco

Verifique se o PostgreSQL está disponível em:

```text
localhost:5432
```

e se o banco configurado está correto.

### Score não consegue enviar para a Decisão

Verifique:

```text
http://localhost:8081/api/v1/decisao/health
```

Se estiverem em computadores diferentes, confira o valor de `DECISION_URL` e use o IP da máquina da Decisão.

---

## 13. Fluxo completo

```text
                 ESTEIRA DE CRÉDITO

              ┌──────────────────┐
              │   Dados cliente  │
              └────────┬─────────┘
                       │
                       v
              ┌──────────────────┐
              │   SCORE ENGINE   │
              │     :8080        │
              └────────┬─────────┘
                       │
                       │ HTTP POST
                       v
              ┌──────────────────┐
              │     DECISÃO      │
              │     :8081        │
              └────────┬─────────┘
                       │
                       v
              ┌──────────────────┐
              │ Resultado /      │
              │ Auditoria        │
              └──────────────────┘
```

---
## 14. Exemplos de Status na Tela Decisão

### Aprovado
![Status Aprovado](https://github.com/AsebiCode/Projeto-APS/blob/c2bd2561253393ad7a0df88ff08d3a3a92050fb0/status_aprovado.jpg)

### Análise Manual
![Status Análise Manual](https://github.com/AsebiCode/Projeto-APS/blob/c2bd2561253393ad7a0df88ff08d3a3a92050fb0/status_analisemanual.jpg)

### Reprovado
![Status Reprovado](https://github.com/AsebiCode/Projeto-APS/blob/c2bd2561253393ad7a0df88ff08d3a3a92050fb0/status_reprovado.jpg)

---

## 15. Evolução futura

Uma evolução prevista é a inclusão do cálculo de juros.

A intenção é manter as responsabilidades separadas, podendo ampliar o fluxo para:

```text
Score
  ↓
Decisão
  ↓
Cálculo de juros
  ↓
Demais etapas da operação
```

O cálculo de juros poderá ser incorporado posteriormente sem colocar essa responsabilidade diretamente no Score ou na Decisão.

---

## Status atual

A integração entre **Score** e **Decisão** foi estruturada para funcionar por HTTP POST.

A Decisão deixou de depender do preenchimento manual dos dados principais e passou a receber o resultado produzido pelo Score.

O projeto permanece aberto para novas integrações e funcionalidades.
