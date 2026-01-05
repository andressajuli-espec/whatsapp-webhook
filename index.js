import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Controle simples de estado por número
const userStage = {};
const userInterest = {};

// VERIFICAÇÃO DO WEBHOOK
app.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// RECEBIMENTO DE MENSAGENS
app.post("/", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.trim();
    let reply = "";

    // INÍCIO OU RESET
    if (!text || ["oi", "olá", "ola"].includes(text.toLowerCase())) {
      userStage[from] = 1;
      reply = `Olá! 👋  
Seja bem-vindo(a) à *CWB Finance*.

Para agilizar seu atendimento, por gentileza, escolha uma das opções abaixo:

1️⃣ Precatórios  
2️⃣ Seguro Auto  
3️⃣ Assessoria Financeira`;
    }

    // ETAPA 1 — ESCOLHA DO SERVIÇO
    else if (userStage[from] === 1 && ["1", "2", "3"].includes(text)) {
      userStage[from] = 2;

      if (text === "1") userInterest[from] = "Precatórios";
      if (text === "2") userInterest[from] = "Seguro Auto";
      if (text === "3") userInterest[from] = "Assessoria Financeira";

      reply = `Perfeito.

Como prefere dar continuidade ao seu atendimento?

1️⃣ Receber ligação de um especialista  
2️⃣ Continuar atendimento pelo WhatsApp`;
    }

    // ETAPA 2 — FORMA DE ATENDIMENTO
    else if (userStage[from] === 2 && ["1", "2"].includes(text)) {
      reply = `Perfeito.

Aguarde um momento, em breve um especialista da *CWB Finance* entrará em contato para dar continuidade ao seu atendimento.`;

      // Limpa o estado após concluir o fluxo
      delete userStage[from];
      delete userInterest[from];
    }

    // RESPOSTA PADRÃO
    else {
      reply =
        "Para prosseguir, por gentileza, responda com uma das opções apresentadas no menu.";
    }

    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("Erro:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
