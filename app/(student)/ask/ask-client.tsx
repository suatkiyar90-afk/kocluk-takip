"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing";
import { askQuestion } from "@/app/actions/qa-actions";
import type { QaThreadSummary } from "@/app/actions/qa-actions";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface AskClientProps {
  initialThreads: QaThreadSummary[];
}

function ThreadCard({ thread }: { thread: QaThreadSummary }) {
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
        <div className="mt-3 rounded-xl bg-indigo-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">
            Öğretmen Yanıtı
          </p>
          {thread.teacherReplyText && (
            <p className="mt-1 text-sm text-gray-900">
              {thread.teacherReplyText}
            </p>
          )}
          {thread.teacherReplyImageUrl && (
            <a
              href={thread.teacherReplyImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600"
            >
              Çözüm görselini aç ↗
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
        <p className="mt-3 text-xs font-medium text-gray-400">
          Öğretmenin yanıtı burada görünecek.
        </p>
      )}
    </div>
  );
}

export function AskClient({ initialThreads }: AskClientProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [threads, setThreads] = useState(initialThreads);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");

  const { startUpload, isUploading } = useUploadThing("questionImage", {
    onUploadError: (error) => {
      toast.error(error.message ?? "Görsel yüklenemedi.");
    },
  });

  const uploading = isUploading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Önce bir fotoğraf seçin.");
      return;
    }
    try {
      const [uploaded] = (await startUpload([file])) ?? [];
      if (!uploaded?.url) {
        toast.error("Görsel yüklenemedi.");
        return;
      }
      const result = await askQuestion({
        questionImageUrl: uploaded.url,
        studentNote: note.trim(),
      });
      if (result.success === false) {
        toast.error(result.message);
        return;
      }
      setThreads((prev) => [result.data, ...prev]);
      setFile(null);
      setNote("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast.success("Sorun öğretmenine iletildi.");
    } catch {
      toast.error("Gönderim sırasında bir hata oluştu.");
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <label
          htmlFor="qa-question-file"
          className="flex h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-sm font-semibold text-indigo-700 transition active:scale-[0.99] touch-manipulation"
        >
          {file ? file.name : "+ Soru Fotoğrafı Seç / Çek"}
        </label>
        <input
          ref={fileInputRef}
          id="qa-question-file"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <label
          htmlFor="qa-question-note"
          className="mt-3 block text-xs font-semibold text-gray-500"
        >
          Not (opsiyonel)
        </label>
        <input
          id="qa-question-note"
          type="text"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Örn: Fonksiyonlar testi 7. soru"
          className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
        />

        <button
          type="submit"
          disabled={uploading || !file}
          className="mt-3 h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:opacity-60 touch-manipulation"
        >
          {uploading ? "Yükleniyor…" : "Öğretmene Gönder"}
        </button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          Gönderdiğim Sorular
        </h2>
        {threads.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-500 shadow-sm">
            Henüz soru göndermedin.
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}