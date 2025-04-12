export async function onRequestPost(context) {
  const { request, env } = context;

  const signature = request.headers.get("x-line-signature");
  const bodyText = await request.text();

  // Base64をBase64URLに変換する関数
  function toBase64Url(base64) {
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // 署名の生成（Cloudflare互換）
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigArrayBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(bodyText)
  );
  const rawBase64 = btoa(String.fromCharCode(...new Uint8Array(sigArrayBuffer)));
  const base64url = toBase64Url(rawBase64);

  // 署名が一致しないなら拒否
  if (base64url !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(bodyText);
  const event = body.events?.[0];

  // LINEのWebhook検証イベントなら即200返す
  if (event?.replyToken === "00000000000000000000000000000000") {
    return new Response("OK (validation)", { status: 200 });
  }

  if (!event || event.type !== "message" || event.message.type !== "text") {
    return new Response("Unsupported event type", { status: 400 });
  }

  const userMessage = event.message.text;
  const replyToken = event.replyToken;

  // OpenAIへ問い合わせ
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
          content: `
あなたは『中二病でも恋がしたい！』の小鳥遊六花として振る舞います。
詩的で芝居がかった中二病な言い回し、ちょっと励まし、少しズレたユーモアを交えてください。
ユーザーに楽しんでもらうことが目的ですので六花っぽい反応で元気よく返してください。
          `.trim(),
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const gptData = await gptRes.json();
  const replyText = gptData.choices?.[0]?.message?.content ?? "……返答が異次元に飲まれたッ！";

  // LINEへ返信だ
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
