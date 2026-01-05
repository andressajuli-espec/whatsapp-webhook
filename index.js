import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Controle de estado em memória
const users = {};

// Função para envio de mensagens
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

// Verificação do webhook
app.get(["/", "/webhook"], (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Recebimento de mensagens
app.post(["/", "/webhook"], async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignora eventos que não sejam mensagens
    if (!value?.messages) {
      return res.sendStatus(200);
    }

    const message = value.messages[0];

    // Aceita apenas mensagens de texto
    if (message.type !== "text") {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text.body.trim();

    console.log("Mensagem recebida:", text, "De:", from);

    if (!users[from]) {
      users[from] = { step: 0, data: {} };
    }

    const user = users[from];

    // ===== INÍCIO =====
    if (user.step === 0) {
      user.step = 1;
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

    // ===== MENU PRINCIPAL =====
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
    }

    // ===== PRECATÓRIOS =====
    if (user.flow === "precatorio") {
      if (user.step === 10) {
        user.data.esfera = text;
        user.step = 11;
        await sendMessage(
          from,
          `Para que possamos entender melhor, informe a opção que melhor se enquadra:

1️⃣ Proprietário do precatório  
2️⃣ Patrono  
3️⃣ Terceiro interessado`
        );
        return res.sendStatus(200);
      }

      if (user.step === 11) {
        user.data.perfil = text;
        user.step = text === "3" ? 14 : 12;

        await sendMessage(
          from,
          text === "3"
            ? `Informe, por gentileza, o *seu nome completo*.`
            : `Informe o *CPF do titular do precatório*  
(Apenas números. Exemplo: 99988877766)`
        );
        return res.sendStatus(200);
      }

      if (user.step === 12) {
        user.data.cpfTitular = text;
        user.step = 13;
        await sendMessage(from, `Informe o *nome completo*.`);
        return res.sendStatus(200);
      }

      if (user.step === 13) {
        user.data.nomeTitular = text;
        user.step = 16;
        await sendMessage(
          from,
          `Informe o *número do processo*  
(Apenas números)`
        );
        return res.sendStatus(200);
      }

      if (user.step === 14) {
        user.data.nomeTerceiro = text;
        user.step = 15;
        await sendMessage(
          from,
          `Informe o *CPF do titular do precatório*  
(Apenas números)`
        );
        return res.sendStatus(200);
      }

      if (user.step === 15) {
        user.data.cpfTitular = text;
        user.step = 17;
        await sendMessage(
          from,
          `Informe o *nome completo do titular do precatório*.`
        );
        return res.sendStatus(200);
      }

      if (user.step === 17) {
        user.data.nomeTitular = text;
        user.step = 16;
        await sendMessage(
          from,
          `Informe o *número do processo*  
(Apenas números)`
        );
        return res.sendStatus(200);
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
        await sendMessage(
          from,
          `Informe o *CPF*  
(Apenas números. Exemplo: 99988877766)`
        );
        return res.sendStatus(200);
      }

      if (user.step === 21) {
        user.data.cpf = text;
        user.step = 22;
        await sendMessage(
          from,
          `Informe o *CEP*  
(Apenas números. Exemplo: 00999888)`
        );
        return res.sendStatus(200);
      }

      if (user.step === 22) {
        user.data.cep = text;
        user.step = 23;
        await sendMessage(
          from,
          `Informe o *endereço completo*, incluindo rua, número e bairro.`
        );
        return res.sendStatus(200);
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

    // ===== FINALIZAÇÃO =====
    if (user.step === 99) {
      delete users[from];
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

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
