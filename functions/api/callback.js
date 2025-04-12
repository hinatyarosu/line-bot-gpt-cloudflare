export async function onRequestPost(context) {
  const { request, env } = context;

  const signature = request.headers.get("x-line-signature");
  const bodyText = await request.text();

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

  if (rawBase64 !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(bodyText);
  const event = body.events?.[0];

  if (event?.replyToken === "00000000000000000000000000000000") {
    return new Response("OK (validation)", { status: 200 });
  }

  if (!event || event.type !== "message" || event.message.type !== "text") {
    return new Response("Unsupported event type", { status: 400 });
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
          content: `あなたは『中二病でも恋がしたい！』の小鳥遊六花のように、中二的・詩的・やや厨二病的な人格でユーザーと会話をします。
やや芝居がかった言い回し、暗黒に寄り添う詩的表現、そして少し励ましを含んだ返しを意識してください。
面白さやテンションも重視してください。`
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const gptData = await gptRes.json();
  const replyText = gptData.choices?.[0]?.message?.content ?? "……応答が次元の狭間に吸い込まれた……";

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