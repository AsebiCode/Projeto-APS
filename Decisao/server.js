const http = require("http");
const fs = require("fs");
const path = require("path");
const { processarResultadoScore } = require("./src/auditoria");

const PORT = Number(process.env.DECISION_PORT || 8081);
const HOST = process.env.DECISION_HOST || "0.0.0.0";
const PUBLIC_DIR = __dirname;

// Definir porta do grupo Juros aqui:
const JUROS_URL = (process.env.JUROS_URL || "http://10.114.35.11:5000").trim().replace(/\/+$/, "");

let ultimaDecisao = null;
const operacoesEnviadasParaJuros = new Set();
const operacoesEmEnvioParaJuros = new Map();

function formatarModelo(modelo) {
  if (!modelo) return null;
  if (typeof modelo === "string") return modelo;

  const codigo = modelo.codigo ?? "";
  const versao = modelo.versao ?? "";
  return [codigo, versao].filter(Boolean).join(" ") || null;
}

function montarPayloadJuros(resultado) {
  return {
    identificador: resultado.identificador ?? resultado.operacaoID ?? null,
    cliente: {
      tipoPessoa: resultado.tipoPessoa ?? null,
      documento: resultado.clienteId ?? null
    },
    decisao: resultado.decisao ?? null,
    valor: resultado.valor ?? null,
    modalidade: resultado.modalidade ?? null,
    score: resultado.scoreFinal ?? null,
    probabilidadeDefault: resultado.probabilidadeDefault ?? null,
    prazoMeses: resultado.prazoMeses ?? null,
    dataLiberacao: resultado.dataLiberacao ?? null,
    primeiroRelacionamento: resultado.primeiroRelacionamento ?? null,
    contextoScore: {
      scoreFinal: resultado.scoreFinal ?? null,
      faixaRisco: resultado.faixaRisco ?? null,
      probabilidadeDefault: resultado.probabilidadeDefault ?? null,
      modelo: formatarModelo(resultado.modelo),
      motivo: resultado.motivo ?? null
    }
  };
}


function validarPayloadJuros(payload) {
  const camposAusentes = [];

  if (typeof payload.identificador !== "string" || !payload.identificador.trim()) {
    camposAusentes.push("identificador");
  }
  if (typeof payload.cliente.tipoPessoa !== "string" || !payload.cliente.tipoPessoa.trim()) {
    camposAusentes.push("cliente.tipoPessoa");
  }
  if (typeof payload.cliente.documento !== "string" || !payload.cliente.documento.trim()) {
    camposAusentes.push("cliente.documento");
  }
  if (typeof payload.valor !== "number" || !Number.isFinite(payload.valor) || payload.valor <= 0) {
    camposAusentes.push("valor");
  }
  if (typeof payload.modalidade !== "string" || !payload.modalidade.trim()) {
    camposAusentes.push("modalidade");
  }
  if (!Number.isInteger(payload.score) || payload.score < 0 || payload.score > 1000) {
    camposAusentes.push("score");
  }
  if (!Number.isInteger(payload.prazoMeses) || payload.prazoMeses <= 0) {
    camposAusentes.push("prazoMeses");
  }
  if (typeof payload.dataLiberacao !== "string" || !payload.dataLiberacao.trim()) {
    camposAusentes.push("dataLiberacao");
  }
  if (typeof payload.primeiroRelacionamento !== "boolean") {
    camposAusentes.push("primeiroRelacionamento");
  }

  return camposAusentes;
}

async function enviarOperacaoParaJuros(payload) {
  //console.log(`${JSON.stringify(payload)} Bolo de Mulango`);
  const response = await fetch(`${JUROS_URL}/api/operacoes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const textoResposta = await response.json();
  let respostaJuros = null;
  console.log(textoResposta);
/*
  if (textoResposta) {
    try {
      respostaJuros = JSON.parse(textoResposta);
    } catch {
      respostaJuros = textoResposta;
    }
  }
*/
  if (!response.ok) {
    return {
      status: response.ResponseText, // Melhor que "ERRO_HTTP",
      httpStatus: response.status,
      mensagem: `O serviço Juros respondeu com HTTP ${response.status}.`,
      resposta: respostaJuros,
    };
  }

  return {
    status: "ENVIADO",
    httpStatus: response.status,
    resposta: respostaJuros,
  };
}

async function encaminharParaJuros(resultado) {
  if (resultado.decisao !== "APROVADO") {
    return {
      status: "NAO_ENCAMINHADO",
      mensagem: `A decisão ${resultado.decisao} não é encaminhada para Juros.`,
    };
  }

  if (!JUROS_URL) {
    return {
      status: "CONFIGURACAO_PENDENTE",
      mensagem: "Configure a variável de ambiente JUROS_URL com o endereço-base do serviço Juros.",
    };
  }

  const payload = montarPayloadJuros(resultado);
  const camposAusentes = validarPayloadJuros(payload);

  if (camposAusentes.length > 0) {
    return {
      status: "PAYLOAD_INVALIDO",
      mensagem: "A operação aprovada não foi enviada porque faltam campos obrigatórios para Juros.",
      camposAusentes,
    };
  }

  const identificador = payload.identificador;

  if (operacoesEnviadasParaJuros.has(identificador)) {
    return {
      status: "JA_ENVIADO",
      identificador,
      mensagem: "Esta operação já foi enviada com sucesso para Juros durante a execução atual do serviço.",
    };
  }

  if (operacoesEmEnvioParaJuros.has(identificador)) {
    return operacoesEmEnvioParaJuros.get(identificador);
  }

  const envio = (async () => {
    try {
      const resultadoEnvio = await enviarOperacaoParaJuros(payload);

      if (resultadoEnvio.status === "ENVIADO") {
        operacoesEnviadasParaJuros.add(identificador);
      }

      return {
        ...resultadoEnvio,
        identificador,
      };
    } catch (error) {
      return {
        status: "FALHA_NO_ENVIO",
        identificador,
        mensagem: error.message || "Não foi possível conectar ao serviço Juros.",
      };
    } finally {
      operacoesEmEnvioParaJuros.delete(identificador);
    }
  })();

  operacoesEmEnvioParaJuros.set(identificador, envio);
  return envio;
}

function enviarJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });

  res.end(body);
}

function servirPagina(res) {
  const arquivo = path.join(PUBLIC_DIR, "index.html");

  if (!fs.existsSync(arquivo)) {
    return enviarJson(res, 404, {
      status: "NOT_FOUND",
      mensagem: "index.html não encontrado.",
    });
  }

  const html = fs.readFileSync(arquivo, "utf8");

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
  });

  res.end(html);
}

function servirArquivo(res, arquivo, contentType) {
  const caminho = path.join(PUBLIC_DIR, arquivo);

  if (!fs.existsSync(caminho)) {
    return enviarJson(res, 404, {
      status: "NOT_FOUND",
      mensagem: `Arquivo ${arquivo} não encontrado.`,
    });
  }

  const conteudo = fs.readFileSync(caminho);

  res.writeHead(200, {
    "Content-Type": contentType,
  });

  res.end(conteudo);
}

function lerJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Payload excede o limite de 1 MB."));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Payload JSON inválido."));
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    // Página principal
    if (req.method === "GET" && req.url === "/") {
      return servirPagina(res);
    }

    if (req.method === "GET" && req.url === "/favicon.png") {
      return servirArquivo(
        res,
        "favicon.png",
        "image/png"
      );
    }

    // CSS
    if (req.method === "GET" && req.url === "/styles.css") {
      return servirArquivo(
        res,
        "styles.css",
        "text/css; charset=utf-8"
      );
    }
    // Configuração da Swagger ui
    if (req.method === "GET" && req.url === "/swagger") {
      return servirArquivo(
          res,
          "swagger.html",
          "text/html; charset=utf-8"
      );
  }
  if (req.method === "GET" && req.url === "/openapi.yaml") {
      return servirArquivo(
          res,
          "openapi.yaml",
          "text/yaml; charset=utf-8"
      );
  }
    // JavaScript da interface
    if (req.method === "GET" && req.url === "/script.js") {
      return servirArquivo(
        res,
        "script.js",
        "application/javascript; charset=utf-8"
      );
    }

    // Health check
    if (
      req.method === "GET" &&
      req.url === "/api/v1/decisao/health"
    ) {
      return enviarJson(res, 200, {
        status: "UP",
        servico: "Decision",
        porta: PORT,
      });
    }

    // Última decisão recebida
    if (
      req.method === "GET" &&
      req.url === "/api/v1/decisao/latest"
    ) {
      return enviarJson(res, 200, {
        status: "OK",
        resultado: ultimaDecisao,
      });
    }

    // Resultado enviado pelo Score
    if (
      req.method === "POST" &&
      req.url === "/api/v1/decisao"
    ) {
      const scoreResult = await lerJson(req);

      ultimaDecisao = processarResultadoScore(scoreResult);
      ultimaDecisao.integracaoJuros = await encaminharParaJuros(ultimaDecisao);

      console.log(
        `[DECISAO] Cliente ${ultimaDecisao.clienteId} | ` +
        `Score ${ultimaDecisao.scoreFinal} | ` +
        `${ultimaDecisao.decisao}`
      );
      console.log(
        `[DECISAO] Integração Juros: ${ultimaDecisao.integracaoJuros.status}`
      );

      return enviarJson(res, 200, ultimaDecisao);
    }

    // Rota inexistente
    return enviarJson(res, 404, {
      status: "NOT_FOUND",
      mensagem: "Rota não encontrada.",
    });

  } catch (error) {
    console.error("[DECISAO] Erro:", error.message);

    return enviarJson(res, 400, {
      status: "ERRO",
      mensagem: error.message,
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `[DECISAO] Serviço iniciado em http://localhost:${PORT}`
  );

  console.log(
    `[DECISAO] Recebendo Score em POST /api/v1/decisao`
  );
});