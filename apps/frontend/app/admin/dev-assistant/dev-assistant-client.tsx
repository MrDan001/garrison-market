// FILE: apps/frontend/app/admin/dev-assistant/dev-assistant-client.tsx

"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Send, Code2, Upload, FileText, Trash2, Loader2, Paperclip, X, Play, ImagePlus, Download, FileDown } from "lucide-react";
import {
  sendDevAssistantMessage,
  getOrCreateDevAssistantThread,
  type DevAssistantChatMessage,
  type DevAssistantImage,
} from "@/lib/dev-assistant.actions";
import { runDevAssistantSandbox } from "@/lib/dev-assistant-sandbox.actions";
import { extractFilesFromReply } from "@/lib/dev-assistant-file-utils";
import {
  getDevAssistantProject,
  getDevAssistantFileContent,
  deleteDevAssistantProject,
  type DevAssistantProjectSummary,
} from "@/lib/dev-assistant-project.actions";

const MAX_IMAGES_PER_MESSAGE = 3; // keep in sync with dev-assistant.actions.ts
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB raw — base64 inflates ~33%, stays well under the 10MB server action body limit

export default function DevAssistantClient({
  threadId,
  initialMessages,
  initialProject,
}: {
  threadId: number;
  initialMessages: DevAssistantChatMessage[];
  initialProject: DevAssistantProjectSummary;
}) {
  const [tab, setTab] = useState<"chat" | "files">("chat");

  // --- Chat (Stage 3 — now live) ---
  const [messages, setMessages] = useState<DevAssistantChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [chatError, setChatError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Which project files are attached to the NEXT message being sent —
  // cleared after each send. This is the "code sent to it" mechanism:
  // the model only ever sees file content the admin explicitly picks here.
  const [attachedIds, setAttachedIds] = useState<number[]>([]);
  const [attachPickerOpen, setAttachPickerOpen] = useState(false);

  useEffect(() => {
    if (tab === "chat") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, tab]);

  function toggleAttachment(fileId: number) {
    setAttachedIds((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]));
  }

  // Images (Stage 5) — attached to the NEXT message only, same lifecycle
  // as attachedIds above. Read client-side as base64 data URLs; never
  // touch the server until the message is actually sent.
  const [pendingImages, setPendingImages] = useState<DevAssistantImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function handleImagesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    setImageError(null);
    const room = MAX_IMAGES_PER_MESSAGE - pendingImages.length;
    if (room <= 0) {
      setImageError(`You can attach up to ${MAX_IMAGES_PER_MESSAGE} images per message.`);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }

    const toAdd = selected.slice(0, room);
    if (selected.length > room) {
      setImageError(`Only added ${room} — max ${MAX_IMAGES_PER_MESSAGE} images per message.`);
    }

    toAdd.forEach((file) => {
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError(`"${file.name}" is too large — max ${MAX_IMAGE_BYTES / 1024 / 1024}MB per image.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPendingImages((prev) => [...prev, { name: file.name, dataUrl }]);
      };
      reader.readAsDataURL(file);
    });

    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function removePendingImage(name: string) {
    setPendingImages((prev) => prev.filter((img) => img.name !== name));
  }

  // --- Sandbox (Stage 4 — new) ---
  // Opt-in per assistant message: a "Run in sandbox" button appears under
  // any reply containing "// FILE:" blocks. Clicking it is the only thing
  // that spends E2B usage — nothing runs automatically.
  const [runningMessageId, setRunningMessageId] = useState<number | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  function hasRunnableFiles(content: string): boolean {
    // Retained for reference — message rendering now calls
    // extractFilesFromReply directly to get the actual file list, not
    // just a yes/no check.
    return /\/\/ FILE: /.test(content);
  }

  async function handleRunSandbox(messageId: number) {
    setRunningMessageId(messageId);
    setSandboxError(null);
    try {
      const result = await runDevAssistantSandbox(threadId, messageId);
      // The action already appended a summary message to the thread —
      // reload from the DB so the chat reflects exactly what's stored,
      // same "resume where you left off" source of truth as everywhere else.
      const fresh = await getOrCreateDevAssistantThread();
      setMessages(fresh.messages);
      if (!result.success && "error" in result) {
        setSandboxError(result.error);
      }
    } catch {
      setSandboxError("Sandbox run failed unexpectedly — please try again.");
    } finally {
      setRunningMessageId(null);
    }
  }

  // --- Downloads (Stage 5 — new) ---
  // Individual files are extracted and downloaded entirely client-side —
  // the content is already sitting in the message that's rendered, so no
  // server round trip is needed. Zipping several files together does need
  // the server (adm-zip), via the download-zip API route.
  const [downloadingZipFor, setDownloadingZipFor] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  function triggerBrowserDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleDownloadFile(path: string, content: string) {
    const filename = path.split("/").pop() || path;
    triggerBrowserDownload(new Blob([content], { type: "text/plain" }), filename);
  }

  async function handleDownloadZip(messageId: number) {
    setDownloadingZipFor(messageId);
    setDownloadError(null);
    try {
      const res = await fetch("/api/dev-assistant/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDownloadError(data?.error ?? "Download failed.");
        return;
      }
      const blob = await res.blob();
      triggerBrowserDownload(blob, "dev-assistant-files.zip");
    } catch {
      setDownloadError("Download failed — please try again.");
    } finally {
      setDownloadingZipFor(null);
    }
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isPending) return;

    setChatError(null);
    const attachNote =
      attachedIds.length > 0
        ? `\n\n📎 Attached: ${attachedIds
            .map((id) => project?.files.find((f) => f.id === id)?.path)
            .filter(Boolean)
            .join(", ")}`
        : "";
    const imageNote =
      pendingImages.length > 0 ? `\n\n📷 Attached image(s): ${pendingImages.map((i) => i.name).join(", ")}` : "";

    const optimisticUser: DevAssistantChatMessage = {
      id: Date.now(),
      role: "user",
      content: trimmed + attachNote + imageNote,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    const idsToSend = attachedIds;
    const imagesToSend = pendingImages;
    setInput("");
    setAttachedIds([]);
    setPendingImages([]);
    setAttachPickerOpen(false);

    startTransition(async () => {
      const result = await sendDevAssistantMessage(threadId, trimmed, idsToSend, imagesToSend);
      if (result.success) {
        setMessages((prev) => [...prev, result.reply]);
      } else {
        setChatError(result.error);
      }
    });
  }

  // --- Files (Stage 2 — unchanged) ---
  const [project, setProject] = useState<DevAssistantProjectSummary>(initialProject);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshProject() {
    const fresh = await getDevAssistantProject();
    setProject(fresh);
  }

  async function handleZipSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadNote(null);
    setSelectedFile(null);

    try {
      const formData = new FormData();
      formData.append("zip", file);

      const res = await fetch("/api/dev-assistant/upload-project", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed.");
      } else {
        await refreshProject();
        setAttachedIds([]);
        const notes: string[] = [];
        if (data.skippedBinary) notes.push(`${data.skippedBinary} binary/non-source files skipped`);
        if (data.skippedTooLarge) notes.push(`${data.skippedTooLarge} files skipped for being too large`);
        setUploadNote(
          `Ingested ${data.project.fileCount} files.` + (notes.length ? ` (${notes.join(", ")})` : "")
        );
      }
    } catch {
      setUploadError("Upload failed — please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSelectFile(fileId: number) {
    setLoadingFile(true);
    setSelectedFile(null);
    const result = await getDevAssistantFileContent(fileId);
    setLoadingFile(false);
    if (result.success) {
      setSelectedFile({ path: result.path, content: result.content });
    }
  }

  async function handleDeleteProject() {
    if (!confirm("Remove the uploaded project? This can't be undone.")) return;
    await deleteDevAssistantProject();
    setProject(null);
    setSelectedFile(null);
    setUploadNote(null);
    setAttachedIds([]);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 sm:px-8 py-4 border-b border-slate-100 dark:border-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Code2 size={16} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider text-[var(--text-primary)] uppercase">
              Dev Assistant
            </h1>
            <p className="text-[11px] text-slate-500">
              Admin only · saved and resumes when you reopen the app
            </p>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
          <button
            onClick={() => setTab("chat")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              tab === "chat" ? "bg-white dark:bg-slate-800 text-blue-500" : "text-slate-500"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setTab("files")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              tab === "files" ? "bg-white dark:bg-slate-800 text-blue-500" : "text-slate-500"
            }`}
          >
            Files{project ? ` (${project.fileCount})` : ""}
          </button>
        </div>
      </div>

      {tab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-4">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Ask about code, request a review, or describe something to build. Attach files from your
                uploaded project using the paperclip below so the AI can actually see them.
              </p>
            )}
            {messages.map((m) => {
              const detectedFiles = m.role === "assistant" ? extractFilesFromReply(m.content) : [];
              return (
                <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-900 text-[var(--text-primary)] font-mono text-[13px]"
                    }`}
                  >
                    {m.content}
                  </div>

                  {detectedFiles.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 max-w-[85%]">
                      <button
                        onClick={() => handleRunSandbox(m.id)}
                        disabled={runningMessageId !== null}
                        className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 disabled:opacity-50"
                      >
                        {runningMessageId === m.id ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Running in sandbox...
                          </>
                        ) : (
                          <>
                            <Play size={13} /> Run in sandbox
                          </>
                        )}
                      </button>

                      <span className="text-slate-300 dark:text-slate-700">·</span>

                      <button
                        onClick={() => handleDownloadZip(m.id)}
                        disabled={downloadingZipFor !== null}
                        className="flex items-center gap-1.5 text-xs font-bold text-blue-500 disabled:opacity-50"
                      >
                        {downloadingZipFor === m.id ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Zipping...
                          </>
                        ) : (
                          <>
                            <Download size={13} /> Download all (.zip)
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {detectedFiles.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[85%]">
                      {detectedFiles.map((f) => (
                        <button
                          key={f.path}
                          onClick={() => handleDownloadFile(f.path, f.content)}
                          title={`Download ${f.path}`}
                          className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-500 hover:border-blue-300"
                        >
                          <FileDown size={11} />
                          {f.path}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {isPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-2.5 bg-slate-100 dark:bg-slate-900 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                  <span className="text-xs text-slate-500">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {chatError && <p className="px-6 sm:px-8 text-xs text-rose-400 pb-2">{chatError}</p>}
          {sandboxError && <p className="px-6 sm:px-8 text-xs text-rose-400 pb-2">{sandboxError}</p>}
          {downloadError && <p className="px-6 sm:px-8 text-xs text-rose-400 pb-2">{downloadError}</p>}
          {imageError && <p className="px-6 sm:px-8 text-xs text-rose-400 pb-2">{imageError}</p>}

          <div className="border-t border-slate-100 dark:border-slate-900">
            {attachPickerOpen && project && (
              <div className="px-6 sm:px-8 py-3 border-b border-slate-100 dark:border-slate-900 max-h-40 overflow-y-auto">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Attach files to this message
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {project.files.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => toggleAttachment(f.id)}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border ${
                        attachedIds.includes(f.id)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {f.path}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {attachedIds.length > 0 && (
              <div className="px-6 sm:px-8 pt-3 flex flex-wrap gap-1.5">
                {attachedIds.map((id) => {
                  const path = project?.files.find((f) => f.id === id)?.path;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 text-[11px] font-mono bg-blue-500/10 text-blue-500 px-2 py-1 rounded-lg"
                    >
                      {path}
                      <X size={10} className="cursor-pointer" onClick={() => toggleAttachment(id)} />
                    </span>
                  );
                })}
              </div>
            )}

            {pendingImages.length > 0 && (
              <div className="px-6 sm:px-8 pt-3 flex flex-wrap gap-1.5">
                {pendingImages.map((img) => (
                  <span
                    key={img.name}
                    className="flex items-center gap-1 text-[11px] font-mono bg-purple-500/10 text-purple-500 px-2 py-1 rounded-lg"
                  >
                    📷 {img.name}
                    <X size={10} className="cursor-pointer" onClick={() => removePendingImage(img.name)} />
                  </span>
                ))}
              </div>
            )}

            <div className="px-6 sm:px-8 py-4 flex gap-2">
              <button
                onClick={() => setAttachPickerOpen((v) => !v)}
                disabled={!project}
                title={project ? "Attach project files" : "Upload a project first (Files tab)"}
                className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-40"
              >
                <Paperclip size={16} />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagesSelected}
                className="hidden"
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={pendingImages.length >= MAX_IMAGES_PER_MESSAGE}
                title="Attach a screenshot or mockup"
                className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-40"
              >
                <ImagePlus size={16} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask the Dev Assistant..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSend}
                disabled={isPending}
                className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "files" && (
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleZipSelected}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Uploading..." : project ? "Replace project (.zip)" : "Upload project (.zip)"}
            </button>

            {project && (
              <button
                onClick={handleDeleteProject}
                className="flex items-center gap-2 rounded-xl border border-rose-500/30 text-rose-400 px-4 py-2.5 text-sm font-bold"
              >
                <Trash2 size={16} />
                Remove
              </button>
            )}
          </div>

          {uploadError && <p className="text-xs text-rose-400">{uploadError}</p>}
          {uploadNote && <p className="text-xs text-emerald-500">{uploadNote}</p>}

          {!project && !uploading && (
            <p className="text-sm text-slate-500">
              No project uploaded yet. Upload a .zip of your codebase — node_modules, build output, and
              binary files are skipped automatically. Once uploaded, switch to Chat and use the paperclip
              icon to attach specific files for the AI to review.
            </p>
          )}

          {project && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-100 dark:border-slate-900 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-900 text-xs font-bold text-slate-500 uppercase tracking-wide truncate">
                  {project.name} · {project.fileCount} files
                </div>
                <div className="max-h-[50vh] overflow-y-auto">
                  {project.files.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFile(f.id)}
                      className={`w-full text-left px-4 py-2 text-xs font-mono flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-900 ${
                        selectedFile?.path === f.path
                          ? "bg-blue-500/10 text-blue-500"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <FileText size={12} className="shrink-0" />
                      <span className="truncate">{f.path}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-slate-100 dark:border-slate-900 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-900 text-xs font-bold text-slate-500 uppercase tracking-wide truncate">
                  {selectedFile ? selectedFile.path : "Select a file"}
                </div>
                <div className="max-h-[50vh] overflow-auto p-4">
                  {loadingFile && <Loader2 size={16} className="animate-spin text-slate-400" />}
                  {!loadingFile && selectedFile && (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-[var(--text-primary)]">
                      {selectedFile.content}
                    </pre>
                  )}
                  {!loadingFile && !selectedFile && (
                    <p className="text-xs text-slate-500">Click a file on the left to view its contents.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}