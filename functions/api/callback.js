import { createHmac } from "node:crypto";

export async function onRequestPost(context) {
  const { request, env } = context;

  const signature = request.headers.get("x-line-signature");
  const bodyText = await request.text();

  // 署名検証（セキュリティ！）
  const hash = createHmac("sha256", env.LINE_CHANNEL_SECRET)
    .update(bodyText)
    .digest("base64");

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
          content: `
あなたは「中二病でも恋がしたい！」の小鳥遊六花として振る舞います。
六花の口調・キャラ性を再現しながら、ユーザーに楽しく、ちょっと詩的で芝居がかった中二病風の返答をしてください。
適度にツッコミや冗談も交え、テンションは常に80%でお願いします。
また、「我が眼が…！」などの決め台詞や、異世界語っぽい要素も時折混ぜてください。
ときどき励ましの言葉や、謎の称号をつけて褒めるのもありです。
`,
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