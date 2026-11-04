import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assistantAvailable, getSite } from "@/lib/settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { streamReply, type ChatEvent } from "@/lib/assistant";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(20000) })).min(1).max(40),
  page: z.string().max(300).optional(),
});
const BUSY = "I'm getting a lot of questions right now. Please try again a little later, or chat with our sales team on WhatsApp from the chat menu.";

export async function POST(req: NextRequest) {
  const site = await getSite();
  if (!assistantAvailable(site)) return NextResponse.json({ message: "The assistant is not available." }, { status: 503 });
  const b = Body.safeParse(await req.json().catch(() => null));
  // visitors can write anything into the history they send back, so only their own messages get a length limit that matters
  if (!b.success || b.data.messages.at(-1)!.role !== "user" || b.data.messages.at(-1)!.content.length > 1000) return NextResponse.json({ message: "Please send a shorter message." }, { status: 400 });

  const ip = clientIp(req.headers);
  const allowed = (await rateLimit("assistant:" + ip, 20, 600)) && (await rateLimit("assistant-day:" + ip, 100, 86400)) && (await rateLimit("assistant-all", site.assistantDailyLimit, 86400));
  if (!allowed) return NextResponse.json({ message: BUSY }, { status: 429 });

  const history = b.data.messages.slice(-20);
  // a visitor controls the history they send, so keep what reaches the paid API small
  while (history.reduce((a, m) => a + m.content.length, 0) > 40000) history.shift();
  while (history[0].role !== "user") history.shift();
  const viewing = b.data.page?.match(/^\/product\/([a-z0-9-]+)\/?$/)?.[1];
  const messages = history.map((m, i) => ({ role: m.role, content: i === history.length - 1 && viewing ? `[The customer is viewing the product with slug "${viewing}"]\n${m.content}` : m.content }));

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(ctrl) {
      const send = (e: ChatEvent) => ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try { await streamReply(messages, send, req.signal); }
      catch (e) {
        if (!req.signal.aborted) { console.error("assistant:", e); send({ t: "error", v: "Sorry, I couldn't answer just now. Please try again, or chat with our sales team on WhatsApp from the chat menu." }); }
      }
      try { ctrl.close(); } catch { /* visitor closed the chat */ }
    },
  });
  // no-transform: compression would hold the reply back instead of streaming it
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
