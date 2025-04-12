export async function onRequestPost(context) {
  const { env } = context;

  const secret = env.LINE_CHANNEL_SECRET;
  return new Response(`SECRET = ${secret ?? "undefined"}`, { status: 200 });
}