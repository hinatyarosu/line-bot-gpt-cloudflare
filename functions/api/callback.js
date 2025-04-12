export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return new Response("No valid events", { status: 400 });
  }

  const event = body.events[0];

  // テキストメッセージかどうか確認
  if (event.type !== "message" || event.message.type !== "text") {
    return new Response("Unsupported event type", { status: 400 });
  }

  const userMessage = event.message.text;
  const replyToken = event.replyToken;

  // GPTに問い合わせ
  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "あなたは中二病っぽく返答してください。" },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const openaiData = await openaiRes.json();
  const replyText = openaiData.choices?.[0]?.message?.content ?? "返答に失敗した…！";

  // LINEに返信
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
    const errorText = await lineRes.text();
    return new Response("LINE reply failed: " + errorText, { status: 500 });
  }

  return new Response("OK", { status: 200 });
}