export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = body.events?.[0];
  if (!event || event.type !== "message" || event.message.type !== "text") {
    return new Response("No valid message event", { status: 400 });
  }

  const userMessage = event.message.text;
  const replyToken = event.replyToken;

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
  const replyText = openaiData.choices?.[0]?.message?.content || "返答に失敗した…！";

  await fetch("https://api.line.me/v2/bot/message/reply", {
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

  return new Response("OK", { status: 200 });
}