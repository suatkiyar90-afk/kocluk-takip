"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing";
import {
  answerQuestion,
  type QaThreadSummary,
} from "@/app/actions/qa-actions";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ReplyFormProps {
  threadId: number;
  onAnswered: (thread: QaThreadSummary) => void;
}

function ReplyForm({ threadId, onAnswered }: ReplyFormProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const image = useUploadThing("replyImage", {
    onUploadError: (error) => {
      toast.error(error.message ?? "Görsel yüklenemedi.");
    },
  });
  const audio = useUploadThing("replyAudio", {
    onUploadError: (error) => {
      toast.error(error.message ?? "Ses kaydı yüklenemedi.");
    },
  });

  const uploading = image.isUploading || audio.isUploading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && !imageFile && !audioFile) {
      toast.error("Yanıt olarak en az metin, görsel veya ses ekleyin.");
      return;
    }
    setSaving(true);
    try {
      let replyImageUrl: string | undefined;
      let replyAudioUrl: string | undefined;

      if (imageFile) {
        const [uploaded] = (await image.startUpload([imageFile])) ?? [];
        if (!uploaded?.url) {
          toast.error("Yanıt görseli yüklenemedi.");
          return;
        }
        replyImageUrl = uploaded.url;
      }
      if (audioFile) {
        const [uploaded] = (await audio.startUpload([audioFile])) ?? [];
        if (!uploaded?.url) {
          toast.error("Ses kaydı yüklenemedi.");
          return;
        }
        replyAudioUrl = uploaded.url;
      }

      const result = await answerQuestion({
        threadId,
        teacherReplyText: trimmed,
        ...(replyImageUrl ? { teacherReplyImageUrl: replyImageUrl } : {}),
        ...(replyAudioUrl ? { teacherReplyAudioUrl: replyAudioUrl } : {}),
      });

      if (result.success === false) {
        toast.error(result.message);
        return;
      }
      onAnswered(result.data);
      setText("");
      setImageFile(null);
      setAudioFile(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      if (audioInputRef.current) {
        audioInputRef.current.value = "";
      }
      toast.success("Yanıt kaydedildi.");
    } catch {
      toast.error("Yanıt gönderilirken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || uploading;

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl bg-indigo-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">
        Yanıtla
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Çözümü buraya yaz…"
        className="mt-2 h-24 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label
          htmlFor={`qa-reply-image-${threadId}`}
          className="flex h-9 cursor-pointer items-center rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700 transition active:scale-[0.98] touch-manipulation"
        >
          {imageFile ? "✓ Görsel eklendi" : "+ Çözüm Görseli"}
        </label>
        <input
          ref={imageInputRef}
          id={`qa-reply-image-${threadId}`}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
        />

        <label
          htmlFor={`qa-reply-audio-${threadId}`}
          className="flex h-9 cursor-pointer items-center rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700 transition active:scale-[0.98] touch-manipulation"
        >
          {audioFile ? "✓ Ses eklendi" : "+ Ses Kaydı"}
        </label>
        <input
          ref={audioInputRef}
          id={`qa-reply-audio-${threadId}`}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
        />

        <button
          type="submit"
          disabled={disabled}
          className="ml-auto h-9 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-60 touch-manipulation"
        >
          {saving || uploading ? "Gönderiliyor…" : "Yanıtla"}
        </button>
      </div>
    </form>
  );
}

function TeacherThreadCard({
  thread,
  onAnswered,
}: {
  thread: QaThreadSummary;
  onAnswered: (thread: QaThreadSummary) => void;
}) {
  const answered = thread.status === "cevaplandı";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <a
          href={thread.questionImageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100"
        >
          <img
            src={thread.questionImageUrl}
            alt="Soru fotoğrafı"
            className="h-full w-full object-cover"
          />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                answered
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {answered ? "Cevaplandı" : "Bekliyor"}
            </span>
            <span className="text-[11px] text-gray-400">
              {formatDateTime(thread.createdAt)}
            </span>
          </div>
          {thread.studentNote && (
            <p className="mt-1.5 text-sm text-gray-700">{thread.studentNote}</p>
          )}
        </div>
      </div>

      {answered ? (
        <div className="mt-3 rounded-xl bg-gray-50 p-3">
          {thread.teacherReplyText && (
            <p className="text-sm text-gray-900">{thread.teacherReplyText}</p>
          )}
          {thread.teacherReplyImageUrl && (
            <a
              href={thread.teacherReplyImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600"
            >
              Yanıt görselini aç ↗
            </a>
          )}
          {thread.teacherReplyAudioUrl && (
            <audio
              controls
              preload="none"
              src={thread.teacherReplyAudioUrl}
              className="mt-2 w-full"
            >
              Tarayıcınız ses kaydını desteklemiyor.
            </audio>
          )}
        </div>
      ) : (
        <ReplyForm threadId={thread.id} onAnswered={onAnswered} />
      )}
    </div>
  );
}

interface TeacherQASectionProps {
  studentId: string;
  initialThreads: QaThreadSummary[];
  emptyText?: string;
}

export function TeacherQASection({
  studentId,
  initialThreads,
  emptyText,
}: TeacherQASectionProps) {
  const [threads, setThreads] = useState(initialThreads);

  function handleAnswered(thread: QaThreadSummary) {
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? thread : t)),
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">
        Gelen Sorular (Soru-Cevap)
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Öğrencinin gönderdiği sorulara metin, görsel veya ses kaydıyla yanıtla.
      </p>

      {threads.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">
          {emptyText ?? "Öğrenci henüz soru göndermedi."}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {threads.map((thread) => (
            <TeacherThreadCard
              key={thread.id}
              thread={thread}
              onAnswered={handleAnswered}
            />
          ))}
        </div>
      )}
    </section>
  );
}