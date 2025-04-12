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
          content: "あなたは中二病のキャラクターとして返答してください。口調は大げさで少し詩的で、現実離れした比喩を多用します。",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const gptData = await gptRes.json();
  const replyText = gptData.choices?.[0]?.message?.content ?? "応答に失敗した…";

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