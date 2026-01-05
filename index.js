import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Controle de estado
const users = {};

// Função de envio de mensagem
async function sendMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
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

// Webhook verification
app.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Webhook receiver
app.post("/", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body?.trim();

    if (!users[from]) users[from] = { step: 0, data: {} };

    const user = users[from];

    // INÍCIO
    if (user.step === 0) {
      user.step = 1;
      return sendMessage(
        from,
        `Olá! 👋  
Seja bem-vindo(a) à *CWB Finance*.

Para agilizar seu atendimento, escolha uma opção:

1️⃣ Precatórios  
2️⃣ Seguro Auto  
3️⃣ Assessoria Financeira`
      );
    }

    // MENU PRINCIPAL
    if (user.step === 1) {
      if (text === "1") {
        user.flow = "precatório";
        user.step = 10;
        return sendMessage(
          from,
          `Perfeito.

Seu precatório é de qual esfera?

1️⃣ Federal  
2️⃣ Estadual  
3️⃣ Municipal`
        );
      }

      if (text === "2") {
        user.flow = "seguro";
        user.step = 20;
        return sendMessage(
          from,
          `Para que possamos prosseguir, informe por gentileza o *nome completo da pessoa que será assegurada*.`
        );
      }

      if (text === "3") {
        user.flow = "assessoria";
        user.step = 30;
        return sendMessage(
          from,
          `Por gentileza, informe seu *nome completo*.`
        );
      }
    }

    // ===== PRECATÓRIOS =====
    if (user.flow === "precatório") {
      if (user.step === 10) {
        user.data.esfera = text;
        user.step = 11;
        return sendMessage(
          from,
          `Para que possamos compreender melhor sua situação, informe a opção que melhor o representa:

1️⃣ Proprietário do precatório  
2️⃣ Patrono  
3️⃣ Terceiro interessado`
        );
      }

      if (user.step === 11) {
        user.data.perfil = text;
        user.step = text === "3" ? 14 : 12;
        return sendMessage(
          from,
          text === "3"
            ? `Por gentileza, informe o *seu nome completo*.`
            : `Informe o *CPF do titular do precatório*  
(Apenas números. Exemplo: 99988877766)`
        );
      }

      if (user.step === 12) {
        user.data.cpf = text;
        user.step = 13;
        return sendMessage(from, `Informe o *nome completo*.`);
      }

      if (user.step === 13) {
        user.data.nome = text;
        user.step = 16;
        return sendMessage(
          from,
          `Informe o *número do processo*  
(Apenas números)`
        );
      }

      if (user.step === 14) {
        user.data.nomeTerceiro = text;
        user.step = 15;
        return sendMessage(
          from,
          `Informe o *CPF do titular do precatório*  
(Apenas números)`
        );
      }

      if (user.step === 15) {
        user.data.cpfTitular = text;
        user.step = 17;
        return sendMessage(from, `Informe o *nome completo do titular do precatório*.`);
      }

      if (user.step === 17) {
        user.data.nomeTitular = text;
        user.step = 16;
        return sendMessage(
          from,
          `Informe o *número do processo*  
(Apenas números)`
        );
      }

      if (user.step === 16) {
        user.data.processo = text;
        user.step = 99;
      }
    }

    // ===== SEGURO AUTO =====
    if (user.flow === "seguro") {
      if (user.step === 20) {
        user.data.nome = text;
        user.step = 21;
        return sendMessage(
          from,
          `Informe o *CPF*  
(Apenas números. Exemplo: 99988877766)`
        );
      }

      if (user.step === 21) {
        user.data.cpf = text;
        user.step = 22;
        return sendMessage(
          from,
          `Informe o *CEP*  
(Apenas números. Exemplo: 00999888)`
        );
      }

      if (user.step === 22) {
        user.data.cep = text;
        user.step = 23;
        return sendMessage(
          from,
          `Informe o *endereço completo*, incluindo rua, número da residência e bairro.`
        );
      }

      if (user.step === 23) {
        user.data.endereco = text;
        user.step = 99;
      }
    }

    // ===== ASSESSORIA =====
    if (user.flow === "assessoria") {
      if (user.step === 30) {
        user.data.nome = text;
        user.step = 99;
      }
    }

    // FINALIZAÇÃO
    if (user.step === 99) {
      delete users[from];
      return sendMessage(
        from,
        `Perfeito.

Aguarde um momento. Em breve um especialista da *CWB Finance* entrará em contato para dar continuidade ao seu atendimento.`
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
