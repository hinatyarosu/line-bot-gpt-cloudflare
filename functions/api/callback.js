export async function onRequestPost(context) {
  const { request, env } = context;

  const signature = request.headers.get("x-line-signature");
  const bodyText = await request.text();

  // Cloudflare対応のHMAC-SHA256計算（node:cryptoの代替）
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const hash = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  if (hash !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(bodyText);
  const event = body.events?.[0];

  if (!event || event.type !== "message" || event.message.type !== "text") {
    return new Response("Unsupported event", { status: 400 });
  }

  const userMessage = event.message.text;
  const replyToken = event.replyToken;

  const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたは「中二病でも恋がしたい！」の小鳥遊六花のように振る舞ってください。詩的で演劇的なセリフ、中二病的表現、そして励ましと冗談を交えた返答をお願いします。",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const gptData = await gptRes.json();
  const replyText = gptData.choices?.[0]?.message?.content ?? "……我が力、応答不能ッ！";

  const lineRes = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: replyText }],
    }),
  });

  if (!lineRes.ok) {
    const err = await lineRes.text();
    return new Response(`LINE API Error: ${err}`, { status: 500 });
  }

  return new Response("OK", { status: 200 });
}