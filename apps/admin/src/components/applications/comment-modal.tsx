"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, X, MessageCircle, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface Comment {
  id: string;
  body: string | null;
  imageUrl: string | null;
  imageSignedUrl: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

interface Props {
  applicationId: string;
  applicationNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export function CommentModal({ applicationId, applicationNumber, isOpen, onClose, onCountChange }: Props) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // onCountChange を ref で保持して無限ループを防ぐ
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => { onCountChangeRef.current = onCountChange; }, [onCountChange]);

  // パネルが開いたときに1回だけコメントを取得
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/applications/${applicationId}/comments`)
      .then((res) => res.ok ? res.json() : [])
      .then((data: Comment[]) => setComments(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, applicationId]);

  // commentsが変化したらカウントを親に通知
  useEffect(() => {
    onCountChangeRef.current?.(comments.length);
  }, [comments]);

  // 最下部にスクロール
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [comments, isOpen]);

  // Escキーで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // 画像選択
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("10MB以下の画像を選択してください");
      return;
    }
    setPendingImage(file);
    setPendingPreview(URL.createObjectURL(file));
    // inputをリセット（同じファイルを再選択できるよう）
    e.target.value = "";
  };

  const clearPendingImage = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingImage(null);
    setPendingPreview(null);
  };

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed && !pendingImage) return;
    if (sending) return;

    const tmpId = `tmp_${Date.now()}`;
    const tmpComment: Comment = {
      id: tmpId,
      body: trimmed || null,
      imageUrl: null,
      imageSignedUrl: pendingPreview,
      createdAt: new Date().toISOString(),
      user: { id: currentUserId, name: session?.user?.name ?? "あなた" },
    };

    setComments((prev) => [...prev, tmpComment]);
    setBody("");
    clearPendingImage();
    setSending(true);

    try {
      let created: Comment & { imageSignedUrl?: string | null };

      if (pendingImage) {
        // 画像付き → multipart/form-data
        const fd = new FormData();
        fd.append("file", pendingImage);
        if (trimmed) fd.append("body", trimmed);
        const res = await fetch(`/api/applications/${applicationId}/comments/upload`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error();
        created = await res.json();
      } else {
        // テキストのみ
        const res = await fetch(`/api/applications/${applicationId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed }),
        });
        if (!res.ok) throw new Error();
        created = await res.json();
      }

      setComments((prev) => prev.map((c) => c.id === tmpId ? { ...created, imageSignedUrl: created.imageSignedUrl ?? null } : c));
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tmpId));
      toast.error("送信に失敗しました");
    } finally {
      setSending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, pendingImage, pendingPreview, sending, currentUserId, session?.user?.name, applicationId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 背景オーバーレイ */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* 右スライドインパネル */}
      <div
        className="fixed top-0 right-0 z-50 h-full bg-white shadow-2xl flex flex-col"
        style={{ width: "25vw", minWidth: "320px" }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            <span className="font-semibold text-sm text-gray-800 truncate">
              コメント — {applicationNumber}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* メッセージ一覧 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50 min-h-0">
          {loading && (
            <div className="flex justify-center pt-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}
          {!loading && comments.length === 0 && (
            <div className="text-center text-gray-400 text-sm pt-8">
              コメントはまだありません
            </div>
          )}
          {comments.map((c) => {
            const isMine = c.user.id === currentUserId;
            const isTmp = c.id.startsWith("tmp_");
            return (
              <div key={c.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                <span className="text-xs text-gray-400 mb-1 px-1">{c.user.name}</span>
                <div className={`max-w-[85%] ${isTmp ? "opacity-60" : ""}`}>
                  {/* 画像 */}
                  {c.imageSignedUrl && (
                    <a href={c.imageSignedUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={c.imageSignedUrl}
                        alt="添付画像"
                        className="rounded-xl max-w-full max-h-48 object-cover mb-1 border cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                  {/* テキスト */}
                  {c.body && (
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words leading-relaxed ${
                        isMine
                          ? "bg-blue-500 text-white rounded-br-md"
                          : "bg-white border text-gray-800 rounded-bl-md shadow-sm"
                      }`}
                    >
                      {c.body}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">{formatTime(c.createdAt)}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* 入力エリア */}
        <div className="border-t shrink-0">
          {/* 画像プレビュー */}
          {pendingPreview && (
            <div className="px-4 pt-3 relative inline-block">
              <img src={pendingPreview} alt="プレビュー" className="h-20 rounded-lg border object-cover" />
              <button
                onClick={clearPendingImage}
                className="absolute -top-1 -right-1 bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-gray-900"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="px-4 py-3 flex items-end gap-2">
            {/* 画像選択ボタン */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-400 hover:text-blue-500 transition-colors shrink-0 p-1"
              title="画像を添付"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 max-h-24 min-h-[40px]"
              placeholder="コメントを入力（Enterで送信、Shift+Enterで改行）"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={(!body.trim() && !pendingImage) || sending}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl p-2 transition-colors shrink-0"
            >
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
