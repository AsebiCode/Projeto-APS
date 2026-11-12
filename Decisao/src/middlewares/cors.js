const ORIGENS_PERMITIDAS = [
    // Score
    "http://localhost:8080",
    process.env.SCORE_URL,
    // Juros
    "http://localhost:5000",
    process.env.JUROS_URL
];

function aplicarCors(req, res) {
    const origem = req.headers.origin;

    // Verifica se a origem da requisição é permitida
    if (ORIGENS_PERMITIDAS.includes(origem)) {
        res.setHeader("Access-Control-Allow-Origin", origem);

        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
        );

        res.setHeader("Access-Control-Max-Age", "86400");
        res.setHeader("Vary", "Origin");
    }

    // Trata a requisição de preflight
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return true;
    }

    return false;
}

module.exports = aplicarCors;