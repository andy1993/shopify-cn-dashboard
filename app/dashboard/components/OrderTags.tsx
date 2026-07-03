"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Plus, Tag, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/* ─── Types ────────────────────────────────────────── */

interface OrderTagsProps {
  orderId: number;
  tags: string[];
  note: string;
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  onTagsChange: (tags: string[]) => void;
  onNoteChange: (note: string) => void;
}

/* ─── Quick tag templates ──────────────────────────── */

const QUICK_TAGS = [
  { label: "待审单", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { label: "已催付", color: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  { label: "高价值客户", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { label: "疑似欺诈", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  { label: "需要发票", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
];

function getTagColor(tag: string): string {
  const found = QUICK_TAGS.find((t) => t.label === tag);
  if (found) return found.color;
  return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

function tagsToString(tags: string[]): string {
  return normalizeTags(tags).join(", ");
}

/* ─── Main Component ───────────────────────────────── */

export default function OrderTags({
  orderId,
  tags,
  note: initialNote,
  isDemo,
  shopUrl,
  accessToken,
  onTagsChange,
  onNoteChange,
}: OrderTagsProps) {
  const [localTags, setLocalTags] = useState<string[]>(() => normalizeTags(tags));
  const [newTag, setNewTag] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagMsg, setTagMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [localNote, setLocalNote] = useState(initialNote);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMsg, setNoteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from parent
  useEffect(() => { setLocalTags(normalizeTags(tags)); }, [tags]);
  useEffect(() => { setLocalNote(initialNote); }, [initialNote]);

  // ── Add tag ──
  const addTag = useCallback(async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const updated = normalizeTags([...localTags, trimmed]);
    if (updated.length === localTags.length) return;

    setLocalTags(updated);
    setNewTag("");

    if (isDemo) {
      onTagsChange(updated);
      showMsg("success", "演示模式：标签已本地更新", setTagMsg);
      return;
    }

    setTagSaving(true);
    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateOrderTags",
          shopUrl,
          accessToken,
          orderId,
          tags: updated,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onTagsChange(updated);
        showMsg("success", "标签已同步至 Shopify", setTagMsg);
      } else {
        setLocalTags(normalizeTags(tags));
        showMsg("error", json.error || "标签更新失败", setTagMsg);
      }
    } catch {
      setLocalTags(normalizeTags(tags));
      showMsg("error", "网络错误，请重试", setTagMsg);
    } finally {
      setTagSaving(false);
    }
  }, [localTags, isDemo, shopUrl, accessToken, orderId, tags, onTagsChange]);

  // ── Remove tag ──
  const removeTag = useCallback(async (tag: string) => {
    const updated = localTags.filter((t) => t !== tag);
    setLocalTags(updated);

    if (isDemo) {
      onTagsChange(updated);
      showMsg("success", "演示模式：标签已本地更新", setTagMsg);
      return;
    }

    setTagSaving(true);
    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateOrderTags",
          shopUrl,
          accessToken,
          orderId,
          tags: updated,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onTagsChange(updated);
        showMsg("success", "标签已同步至 Shopify", setTagMsg);
      } else {
        setLocalTags(normalizeTags(tags));
        showMsg("error", json.error || "标签更新失败", setTagMsg);
      }
    } catch {
      setLocalTags(normalizeTags(tags));
      showMsg("error", "网络错误，请重试", setTagMsg);
    } finally {
      setTagSaving(false);
    }
  }, [localTags, isDemo, shopUrl, accessToken, orderId, tags, onTagsChange]);

  // ── Save note (debounced auto-save) ──
  const saveNote = useCallback(async (note: string) => {
    setNoteSaving(true);
    if (isDemo) {
      onNoteChange(note);
      showMsg("success", "演示模式：备注已本地更新", setNoteMsg);
      setNoteSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateOrderNote",
          shopUrl,
          accessToken,
          orderId,
          note,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onNoteChange(note);
        showMsg("success", "备注已自动保存", setNoteMsg);
      } else {
        showMsg("error", json.error || "备注保存失败", setNoteMsg);
      }
    } catch {
      showMsg("error", "网络错误，请重试", setNoteMsg);
    } finally {
      setNoteSaving(false);
    }
  }, [isDemo, shopUrl, accessToken, orderId, onNoteChange]);

  const handleNoteChange = (val: string) => {
    setLocalNote(val);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => saveNote(val), 1000);
  };

  // ── Helper: timed toast ──
  function showMsg(
    type: "success" | "error",
    text: string,
    setter: (v: { type: "success" | "error"; text: string } | null) => void,
  ) {
    setter({ type, text });
    setTimeout(() => setter(null), 2500);
  }

  return (
    <div className="space-y-5">
      {/* Tags */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          <Tag className="h-3 w-3" />订单标签
          {tagSaving && <Loader2 className="h-3 w-3 animate-spin text-amber-400" />}
        </p>

        {/* Current tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {localTags.length > 0 ? (
            localTags.map((tag) => (
              <Badge key={tag} className={"text-[10px] px-2 py-0.5 gap-1 border " + getTagColor(tag)}>
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:opacity-70 transition-opacity cursor-pointer"
                  disabled={tagSaving}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground/50">暂无标签</span>
          )}
        </div>

        {/* Tag message */}
        {tagMsg && (
          <div className="flex items-center gap-1 text-xs mb-2">
            {tagMsg.type === "success"
              ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              : <AlertCircle className="h-3 w-3 text-red-400" />}
            <span className={tagMsg.type === "success" ? "text-emerald-400" : "text-red-400"}>{tagMsg.text}</span>
          </div>
        )}

        {/* Add tag input */}
        <div className="flex items-center gap-1.5">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTag(newTag); }}
            placeholder="输入新标签..."
            className="h-8 text-xs"
            disabled={tagSaving}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => addTag(newTag)}
            disabled={tagSaving || !newTag.trim()}
            className="h-8 gap-1 text-xs"
          >
            <Plus className="h-3 w-3" />添加
          </Button>
        </div>

        {/* Quick tags */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {QUICK_TAGS.map((qt) => (
            <button
              key={qt.label}
              onClick={() => addTag(qt.label)}
              disabled={tagSaving || localTags.includes(qt.label)}
              className={`text-[10px] px-2 py-1 rounded border cursor-pointer transition-opacity hover:opacity-80 ${
                localTags.includes(qt.label) ? "opacity-30 cursor-not-allowed" : ""
              } ${qt.color}`}
            >
              + {qt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          <FileText className="h-3 w-3" />订单备注
          {noteSaving && <Loader2 className="h-3 w-3 animate-spin text-amber-400" />}
        </p>

        <textarea
          value={localNote}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="添加订单备注..."
          rows={3}
          className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />

        {noteMsg && (
          <div className="flex items-center gap-1 text-xs mt-1.5">
            {noteMsg.type === "success"
              ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              : <AlertCircle className="h-3 w-3 text-red-400" />}
            <span className={noteMsg.type === "success" ? "text-emerald-400" : "text-red-400"}>{noteMsg.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
