export async function onRequestPost(context) {
  const { request, env } = context;
  const signature = request.headers.get("x-line-signature");
  const bodyText = await request.text();

  // Base64URL変換関数
  function toBase64Url(base64) {
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // Cloudflare対応署名チェック（Base64URL対応）
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigArrayBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const rawBase64 = btoa(String.fromCharCode(...new Uint8Array(sigArrayBuffer)));
  const base64url = toBase64Url(rawBase64);

  if (base64url !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(bodyText);
  const event = body.events?.[0];

  // Webhook検証用イベントならスキップ
  if (event.replyToken === "00000000000000000000000000000000") {
    return new Response("OK (validation)", { status: 200 });
  }

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
          content: "あなたは『中二病でも恋がしたい！』の小鳥遊六花のように中二的・詩的・ちょい励ましな返答を行ってください。",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const gptData = await gptRes.json();
  const replyText = gptData.choices?.[0]?.message?.content ?? "……返答が次元の狭間に消えた……";

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