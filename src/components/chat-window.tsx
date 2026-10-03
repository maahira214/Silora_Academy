"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { MessageDTO } from "@/server/chat";
import { Icon } from "@/components/icons";
import { cx } from "@/components/ui";

type SendResult = { error?: string; warning?: string; ok?: boolean };

const POLL_MS = 3000;

export function ChatWindow({
  threadId,
  initialMessages,
  initialCanPost,
  initialReadOnlyReason,
  send,
  maxUploadMb,
}: {
  threadId: string;
  initialMessages: MessageDTO[];
  initialCanPost: boolean;
  initialReadOnlyReason?: string | null;
  send?: (fd: FormData) => Promise<SendResult>;
  maxUploadMb: number;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [canPost, setCanPost] = useState(initialCanPost);
  const [readOnlyReason, setReadOnlyReason] = useState(initialReadOnlyReason);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastAt = useRef(initialMessages.at(-1)?.createdAt);

  const merge = useCallback((incoming: MessageDTO[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      lastAt.current = next.at(-1)?.createdAt;
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    const url = `/api/threads/${threadId}/messages${lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : ""}`;
    const res = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { messages: MessageDTO[]; canPost: boolean; readOnlyReason: string | null };
    merge(data.messages);
    setCanPost(data.canPost);
    setReadOnlyReason(data.readOnlyReason);
  }, [threadId, merge]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = () => {
    if (!send || (!text.trim() && !file)) return;
    if (file && file.size > maxUploadMb * 1024 * 1024) {
      setError(`Files must be smaller than ${maxUploadMb} MB.`);
      return;
    }
    const fd = new FormData();
    fd.set("body", text);
    if (file) fd.set("file", file);
    setError(null);
    setWarning(null);
    startTransition(async () => {
      const res = await send(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.warning) setWarning(res.warning);
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await poll();
    });
  };

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-5">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No messages yet. Say hello 👋</p>}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {canPost && send ? (
        <div className="border-t border-slate-200 bg-white p-3">
          {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          {warning && <p className="mb-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">{warning}</p>}
          {file && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-gold-50 px-3 py-2 text-sm text-navy-900">
              <Icon name="file" className="size-4" />
              <span className="flex-1 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-slate-500 hover:text-red-600"
              >
                <Icon name="x" className="size-4" />
                <span className="sr-only">Remove file</span>
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="cursor-pointer rounded-full p-2.5 text-slate-500 hover:bg-slate-100 hover:text-navy-800" title="Attach a file">
              <Icon name="paperclip" />
              <span className="sr-only">Attach a file</span>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Type a message…"
              className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border-0 bg-slate-100 px-4 py-2.5 text-sm focus:ring-2 focus:ring-gold-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={submit}
              disabled={pending || (!text.trim() && !file)}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-500 text-navy-900 hover:bg-gold-400 disabled:opacity-40"
            >
              <Icon name="send" />
              <span className="sr-only">Send</span>
            </button>
          </div>
          <p className="mt-1.5 px-2 text-[11px] text-slate-400">
            Keep all communication on Silora. Phone numbers, emails and social handles are not allowed.
          </p>
        </div>
      ) : (
        <div className="border-t border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-500">{readOnlyReason ?? "Read-only"}</div>
      )}
    </div>
  );
}

function Bubble({ m }: { m: MessageDTO }) {
  const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const day = new Date(m.createdAt).toLocaleDateString([], { day: "numeric", month: "short" });
  const removed = m.status === "REMOVED" && !m.body;
  const isImage = m.attachment?.mimeType.startsWith("image/") && m.attachment.mimeType !== "image/heic";
  return (
    <div className={cx("flex", m.mine ? "justify-end" : "justify-start")}>
      <div className={cx("max-w-[85%] sm:max-w-[70%]", m.mine && "items-end")}>
        {!m.mine && <p className="mb-0.5 px-1 text-[11px] font-semibold text-slate-500">{m.sender}</p>}
        <div
          className={cx(
            "rounded-2xl px-3.5 py-2 text-sm shadow-sm",
            m.mine ? "rounded-br-md bg-navy-800 text-white" : "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200",
            (m.status === "BLOCKED" || m.status === "QUARANTINED") && "opacity-60",
          )}
        >
          {removed ? (
            <p className="italic opacity-70">Message removed</p>
          ) : (
            <>
              {m.attachment && (
                <a href={`/api/files/${m.attachment.id}`} target="_blank" rel="noreferrer" className="mb-1 block">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${m.attachment.id}`} alt={m.attachment.fileName} className="max-h-64 rounded-lg" />
                  ) : (
                    <span className={cx("flex items-center gap-2 rounded-lg px-2 py-1.5", m.mine ? "bg-navy-700" : "bg-slate-100")}>
                      <Icon name="file" className="size-4 shrink-0" />
                      <span className="truncate font-medium underline-offset-2 hover:underline">{m.attachment.fileName}</span>
                      <span className="shrink-0 text-[11px] opacity-70">{Math.max(1, Math.round(m.attachment.sizeBytes / 1024))} KB</span>
                    </span>
                  )}
                </a>
              )}
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
            </>
          )}
          <p className={cx("mt-0.5 text-right text-[10px]", m.mine ? "text-navy-200" : "text-slate-400")}>
            {day} · {time}
          </p>
        </div>
        {m.notice && <p className="mt-1 px-1 text-[11px] font-medium text-orange-700">{m.notice}</p>}
      </div>
    </div>
  );
}
