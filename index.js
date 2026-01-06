import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

/**
 * ===============================
 * CONFIGURAÇÕES BÁSICAS
 * ===============================
 */
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

/**
 * ===============================
 * CONFIGURAÇÃO DE INATIVIDADE
 * ===============================
 * 36 horas em milissegundos
 */
const INACTIVITY_LIMIT = 36 * 60 * 60 * 1000;

/**
 * ===============================
 * CONTROLE DE SESSÕES (MEMÓRIA)
 * ===============================
 */
const users = {};

/**
 * ===============================
 * FUNÇÃO DE ENVIO DE MENSAGEM
 * ===============================
 */
async function sendMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

/**
 * ===============================
 * VERIFICAÇÃO DO WEBHOOK (META)
 * ===============================
 */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * ===============================
 * RECEBIMENTO DE MENSAGENS
 * ===============================
 */
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignora eventos que não sejam mensagens
    if (!value?.messages) {
      return res.sendStatus(200);
    }

    const message = value.messages[0];

    // Ignora mensagens não textuais
    if (message.type !== "text") {
      return res.sendStatus(200);
    }

    // Ignora mensagens enviadas pelo próprio número (echo)
    if (message.from === value.metadata?.phone_number_id) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text.body.trim();
    const now = Date.now();

    console.log("Mensagem recebida:", text, "De:", from);

    /**
     * ===============================
     * CONTROLE DE USUÁRIO
     * ===============================
     */
    if (!users[from]) {
      users[from] = {
        step: 0,
        flow: null,
        data: {},
        status: "novo",
        lastInteraction: now
      };
    }

    const user = users[from];

    const inactiveTime = now - user.lastInteraction;
    user.lastInteraction = now;

    /**
     * ===============================
     * BLOQUEIO DE REINÍCIO
     * ===============================
     */
    if (user.status === "finalizado" && inactiveTime < INACTIVITY_LIMIT) {
      return res.sendStatus(200);
    }

    // Reinicia após 36h
    if (user.status === "finalizado" && inactiveTime >= INACTIVITY_LIMIT) {
      user.step = 0;
      user.flow = null;
      user.data = {};
      user.status = "novo";
    }

    /**
     * ===============================
     * INÍCIO DO BOT
     * ===============================
     */
    if (user.step === 0) {
      user.step = 1;
      user.status = "em_atendimento_bot";

      await sendMessage(
        from,
        `Olá!  
Você entrou em contato com a *CWB Finance*.

Para agilizar seu atendimento, escolha uma opção:

1️⃣ Precatórios  
2️⃣ Seguro Auto  
3️⃣ Assessoria`
      );
      return res.sendStatus(200);
    }

    /**
     * ===============================
     * MENU PRINCIPAL
     * ===============================
     */
    if (user.step === 1) {
      if (text === "1") {
        user.flow = "precatorio";
        user.step = 10;
        await sendMessage(
          from,
          `Perfeito.

Seu precatório é de qual esfera?

1️⃣ Federal  
2️⃣ Estadual  
3️⃣ Municipal`
        );
        return res.sendStatus(200);
      }

      if (text === "2") {
        user.flow = "seguro";
        user.step = 20;
        await sendMessage(
          from,
          `Para prosseguirmos, informe o *nome completo da pessoa que será assegurada*.`
        );
        return res.sendStatus(200);
      }

      if (text === "3") {
        user.flow = "assessoria";
        user.step = 30;
        await sendMessage(
          from,
          `Por gentileza, informe seu *nome completo*.`
        );
        return res.sendStatus(200);
      }

      return res.sendStatus(200);
    }

    /**
     * ===============================
     * PRECATÓRIOS
     * ===============================
     */
    if (user.flow === "precatorio") {
      if (user.step === 10) {
        user.step = 11;
        await sendMessage(
          from,
          `Informe a opção correspondente:

1️⃣ Proprietário do precatório  
2️⃣ Patrono  
3️⃣ Terceiro interessado`
        );
        return res.sendStatus(200);
      }

      if (user.step === 11) {
        user.step = text === "3" ? 14 : 12;
        await sendMessage(
          from,
          text === "3"
            ? `Informe seu *nome completo*.`
            : `Informe o *CPF do titular do precatório*  
(Apenas números)`
        );
        return res.sendStatus(200);
      }

      if (user.step === 12) {
        user.step = 13;
        await sendMessage(from, `Informe o *nome completo do titular*.`);
        return res.sendStatus(200);
      }

      if (user.step === 13) {
        user.step = 16;
        await sendMessage(from, `Informe o *número do processo*.`);
        return res.sendStatus(200);
      }

      if (user.step === 14) {
        user.step = 15;
        await sendMessage(from, `Informe o *CPF do titular do precatório*.`);
        return res.sendStatus(200);
      }

      if (user.step === 15) {
        user.step = 17;
        await sendMessage(from, `Informe o *nome completo do titular*.`);
        return res.sendStatus(200);
      }

      if (user.step === 17) {
        user.step = 16;
        await sendMessage(from, `Informe o *número do processo*.`);
        return res.sendStatus(200);
      }

      if (user.step === 16) {
        user.step = 99;
      }
    }

    /**
     * ===============================
     * SEGURO AUTO
     * ===============================
     */
    if (user.flow === "seguro") {
      if (user.step === 20) {
        user.step = 21;
        await sendMessage(from, `Informe o *CPF*.`);
        return res.sendStatus(200);
      }

      if (user.step === 21) {
        user.step = 22;
        await sendMessage(from, `Informe o *CEP*.`);
        return res.sendStatus(200);
      }

      if (user.step === 22) {
        user.step = 23;
        await sendMessage(from, `Informe o *endereço completo*.`);
        return res.sendStatus(200);
      }

      if (user.step === 23) {
        user.step = 99;
      }
    }

    /**
     * ===============================
     * ASSESSORIA
     * ===============================
     */
    if (user.flow === "assessoria" && user.step === 30) {
      user.step = 99;
    }

    /**
     * ===============================
     * FINALIZAÇÃO
     * ===============================
     */
    if (user.step === 99) {
      user.status = "finalizado";

      await sendMessage(
        from,
        `Perfeito.

Aguarde um momento. Em breve um especialista da *CWB Finance* entrará em contato para dar continuidade ao seu atendimento.`
      );
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Erro no webhook:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

/**
 * ===============================
 * INICIALIZAÇÃO DO SERVIDOR
 * ===============================
 */
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
