export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();

  const userMessage = body.events?.[0]?.message?.text;
  const replyToken = body.events?.[0]?.replyToken;

  if (!userMessage || !replyToken) {
    return new Response("No valid message or replyToken", { status: 400 });
  }

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "あなたは中二病のキャラとして振る舞ってください。" },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const openaiData = await openaiRes.json();
  const replyText = openaiData.choices?.[0]?.message?.content || "応答できませんでした…！";

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