"use client";

import { useState, useMemo, useEffect } from "react";
import {
  FileText, BookOpen, Plus, X, ChevronDown, ChevronRight, Save,
  Trash2, Edit3, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2,
  Tag, Globe,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

interface PageItem {
  id: number;
  title: string;
  handle: string;
  bodyHtml: string;
  published: boolean;
  seoTitle: string;
  seoDescription: string;
  created_at: string;
  updated_at: string;
}

interface BlogItem {
  id: number;
  title: string;
  handle: string;
}

interface ArticleItem {
  id: number;
  title: string;
  handle: string;
  bodyHtml: string;
  summaryHtml: string;
  author: string;
  tags: string[];
  published: boolean;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
  blogId?: number;
}

interface ContentPagesPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  pages?: PageItem[];
  blogs?: Array<{ id: number; title: string; handle: string; articles: ArticleItem[] }>;
}

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_PAGES: PageItem[] = [
  { id: 1, title: "关于我们", handle: "about", bodyHtml: "<p>我们是一家专注于跨境电商的品牌，成立于 2020 年。</p><p>致力于为全球用户提供高品质的生活方式产品。</p>", published: true, seoTitle: "关于我们", seoDescription: "了解我们的品牌故事和团队。", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, title: "联系我们", handle: "contact", bodyHtml: "<p><strong>邮箱：</strong>support@example.com</p><p><strong>工作时间：</strong>周一至周五 9:00-18:00</p>", published: true, seoTitle: "联系我们", seoDescription: "有任何问题？随时联系我们。", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, title: "FAQ 常见问题", handle: "faq", bodyHtml: "<ul><li><strong>如何退换货？</strong> 30 天内支持无忧退换。</li><li><strong>发货时间？</strong> 下单后 48 小时内发货。</li></ul>", published: true, seoTitle: "FAQ 常见问题", seoDescription: "常见问题解答。", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const DEMO_ARTICLES: ArticleItem[] = [
  { id: 101, blogId: 1, title: "2026 夏季新品发布", handle: "summer-2026", bodyHtml: "<p>今年夏天，我们推出了全新系列...</p><p><strong>亮点：</strong>更轻、更快、更强。</p>", summaryHtml: "夏季新品发布概览。", author: "Admin", tags: ["新品", "夏季"], published: true, seoTitle: "2026 夏季新品发布", seoDescription: "查看我们的夏季新品。", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 102, blogId: 1, title: "如何选择适合你的智能手表", handle: "choose-smartwatch", bodyHtml: "<p>智能手表市场琳琅满目，以下是我们的一些建议...</p><ol><li>确定预算</li><li>选择核心功能</li><li>对比续航</li></ol>", summaryHtml: "智能手表选购指南。", author: "Admin", tags: ["选购指南", "智能手表"], published: true, seoTitle: "如何选择智能手表", seoDescription: "完整的智能手表选购指南。", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 103, blogId: 1, title: "会员日大促提前剧透", handle: "member-day", bodyHtml: "<p>即将到来的会员日，全场最低 5 折！</p><p>提前加入购物车，锁定好价。</p>", summaryHtml: "会员日大促预告。", author: "Editor", tags: ["促销", "会员日"], published: false, seoTitle: "会员日大促预告", seoDescription: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const DEMO_BLOGS: BlogItem[] = [{ id: 1, title: "News 博客", handle: "news" }];

/* ─── SEO Preview ─────────────────────────────────────── */

function SeoPreview({ title, handle, description, shopDomain }: { title: string; handle: string; description: string; shopDomain: string }) {
  return (
    <div className="rounded-lg border border-border/20 bg-card p-3 max-w-md">
      <p className="text-sm font-medium text-sky-400 truncate">{title.slice(0, 70) || "标题"}</p>
      <p className="text-xs text-emerald-400/70 truncate">{(shopDomain || "店铺") + (handle ? "/" + (handle.startsWith("pages/") ? "" : "pages/") + handle.replace(/^pages\//, "") : "")}</p>
      <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-2">{description.slice(0, 320) || "暂无描述"}</p>
    </div>
  );
}

/* ─── Content Preview/Edit Toggle ────────────────────── */

function ContentEditor({ html, onChange, descMode, setDescMode }: { html: string; onChange: (v: string) => void; descMode: "preview" | "edit"; setDescMode: (m: "preview" | "edit") => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">内容</label>
        <div className="flex bg-muted/20 rounded-md p-0.5">
          <button onClick={() => setDescMode("preview")} className={`px-2 py-0.5 text-xs rounded font-medium ${descMode === "preview" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground"}`}>预览</button>
          <button onClick={() => setDescMode("edit")} className={`px-2 py-0.5 text-xs rounded font-medium ${descMode === "edit" ? "bg-sky-500/20 text-sky-400" : "text-muted-foreground"}`}>编辑</button>
        </div>
      </div>
      {descMode === "preview" ? (
        <div className="min-h-[80px] rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-sm text-foreground overflow-auto [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-1 [&_strong]:font-bold" dangerouslySetInnerHTML={{ __html: html || "<span class='text-muted-foreground italic'>暂无内容</span>" }} />
      ) : (
        <textarea value={html} onChange={(e) => onChange(e.target.value)} rows={5} placeholder="输入 HTML 格式内容..." className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm text-foreground font-mono resize-y" />
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────── */

export default function ContentPagesPanel({ isDemo, shopUrl, accessToken, shopName, pages: pagesProp, blogs: blogsProp }: ContentPagesPanelProps) {
  /* ── Tab ───────────────────────────────────────────── */
  const [tab, setTab] = useState<"pages" | "blog">("pages");

  /* ── Pages state ──────────────────────────────────── */
  const [pages, setPages] = useState<PageItem[]>(() => isDemo ? DEMO_PAGES : []);
  const [pageExpandedId, setPageExpandedId] = useState<number | null>(null);
  const [pageForm, setPageForm] = useState<Partial<PageItem> | null>(null);
  const [pageDeleteId, setPageDeleteId] = useState<number | null>(null);
  const [pageDescMode, setPageDescMode] = useState<"preview" | "edit">("preview");

  /* ── Blog/Article state ───────────────────────────── */
  const [blogs, setBlogs] = useState<BlogItem[]>(() => isDemo ? DEMO_BLOGS : []);
  const [articles, setArticles] = useState<ArticleItem[]>(() => isDemo ? DEMO_ARTICLES : []);
  const [selectedBlogId, setSelectedBlogId] = useState<number>(1);
  const [articleExpandedId, setArticleExpandedId] = useState<number | null>(null);
  const [articleForm, setArticleForm] = useState<Partial<ArticleItem> | null>(null);
  const [articleDeleteId, setArticleDeleteId] = useState<number | null>(null);
  const [articleDescMode, setArticleDescMode] = useState<"preview" | "edit">("preview");

  /* ── Toast ────────────────────────────────────────── */
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  /* ── Init from props ──────────────────────────────── */
  useEffect(() => {
    if (!isDemo && pagesProp) setPages(pagesProp);
    if (!isDemo && blogsProp) {
      setBlogs(blogsProp.map(({ id, title, handle }) => ({ id, title, handle })));
      setArticles(blogsProp.flatMap((b) => b.articles.map((a) => ({ ...a, blogId: b.id }))));
      if (blogsProp.length > 0) setSelectedBlogId(blogsProp[0].id);
    }
  }, [isDemo, pagesProp, blogsProp]);

  const blogArticles = useMemo(() => articles.filter((a) => a.blogId === selectedBlogId), [articles, selectedBlogId]);

  /* ── Page CRUD ────────────────────────────────────── */
  const togglePageExpand = (id: number) => {
    if (pageExpandedId === id) { setPageExpandedId(null); setPageForm(null); return; }
    const p = pages.find((x) => x.id === id);
    if (p) { setPageExpandedId(id); setPageForm({ ...p }); setPageDescMode("preview"); }
  };

  const createPage = () => {
    const newPage: PageItem = { id: Date.now(), title: "新页面", handle: "", bodyHtml: "", published: false, seoTitle: "", seoDescription: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setPages((prev) => [newPage, ...prev]);
    setPageExpandedId(newPage.id);
    setPageForm({ ...newPage });
    setPageDescMode("preview");
  };

  const savePage = () => {
    if (!pageForm || pageExpandedId === null || !pageForm.title) return;
    setPages((prev) => prev.map((p) => p.id === pageExpandedId ? { ...p, ...pageForm, updated_at: new Date().toISOString() } as PageItem : p));
    showToast(isDemo ? "演示模式：已本地生效" : "页面已保存");
    setPageExpandedId(null); setPageForm(null);
  };

  const deletePage = (id: number) => { setPages((prev) => prev.filter((p) => p.id !== id)); setPageDeleteId(null); setPageExpandedId(null); showToast("页面已删除"); };

  /* ── Article CRUD ─────────────────────────────────── */
  const toggleArticleExpand = (id: number) => {
    if (articleExpandedId === id) { setArticleExpandedId(null); setArticleForm(null); return; }
    const a = articles.find((x) => x.id === id);
    if (a) { setArticleExpandedId(id); setArticleForm({ ...a }); setArticleDescMode("preview"); }
  };

  const createArticle = () => {
    const newArticle: ArticleItem = { id: Date.now(), blogId: selectedBlogId, title: "新文章", handle: "", bodyHtml: "", summaryHtml: "", author: "Admin", tags: [], published: false, seoTitle: "", seoDescription: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setArticles((prev) => [newArticle, ...prev]);
    setArticleExpandedId(newArticle.id);
    setArticleForm({ ...newArticle });
    setArticleDescMode("preview");
  };

  const saveArticle = () => {
    if (!articleForm || articleExpandedId === null || !articleForm.title) return;
    setArticles((prev) => prev.map((a) => a.id === articleExpandedId ? { ...a, ...articleForm, updatedAt: new Date().toISOString() } as ArticleItem : a));
    showToast(isDemo ? "演示模式：已本地生效" : "文章已保存");
    setArticleExpandedId(null); setArticleForm(null);
  };

  const deleteArticle = (id: number) => { setArticles((prev) => prev.filter((a) => a.id !== id)); setArticleDeleteId(null); setArticleExpandedId(null); showToast("文章已删除"); };

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>}

      {/* Header + Tabs */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><FileText className="h-6 w-6 text-amber-400" />页面与博客</h2>
        <p className="mt-1 text-base text-muted-foreground">{shopName} · {pages.length} 页面 · {articles.length} 文章{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setTab("pages")} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === "pages" ? "bg-amber-500/15 text-amber-400" : "text-muted-foreground"}`}>页面 Pages</button>
          <button onClick={() => setTab("blog")} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === "blog" ? "bg-purple-500/15 text-purple-400" : "text-muted-foreground"}`}>博客文章 Blog Posts</button>
        </div>
      </div>

      {/* ══ TAB: Pages ══ */}
      {tab === "pages" && (
        <>
          <Button size="sm" onClick={createPage} className="h-9 gap-1 bg-amber-600 hover:bg-amber-500 text-white text-sm"><Plus className="h-3 w-3" />新建页面</Button>
          <div className="space-y-2">
            {pages.map((p) => (
              <Card key={p.id} className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/20" onClick={() => togglePageExpand(p.id)}>
                  {pageExpandedId === p.id ? <ChevronDown className="h-4 w-4 shrink-0 text-amber-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="flex-1 min-w-0"><p className="text-base font-semibold truncate">{p.title}</p><p className="text-xs text-muted-foreground">/{p.handle || "—"}</p></div>
                  <Badge className={`text-xs ${p.published ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>{p.published ? <><Eye className="h-2.5 w-2.5 mr-0.5 inline" />已发布</> : <><EyeOff className="h-2.5 w-2.5 mr-0.5 inline" />隐藏</>}</Badge>
                  <button onClick={(e) => { e.stopPropagation(); setPageDeleteId(p.id); }} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {/* Expand */}
                {pageExpandedId === p.id && pageForm && (
                  <CardContent className="px-5 py-3 border-t border-border/20 space-y-3 animate-[fadeIn_0.15s]">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">标题 *</label><Input value={pageForm.title || ""} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} className="h-9 text-sm" /></div>
                      <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">URL 句柄</label><Input value={pageForm.handle || ""} onChange={(e) => setPageForm({ ...pageForm, handle: e.target.value })} className="h-9 text-sm" /></div>
                    </div>
                    <ContentEditor html={pageForm.bodyHtml || ""} onChange={(v) => setPageForm({ ...pageForm, bodyHtml: v })} descMode={pageDescMode} setDescMode={setPageDescMode} />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer"><input type="checkbox" checked={!!pageForm.published} onChange={() => setPageForm({ ...pageForm, published: !pageForm.published })} className="accent-emerald-500" />已发布</label>
                    <details className="group"><summary className="text-xs font-semibold text-muted-foreground cursor-pointer">SEO <ChevronDown className="h-3 w-3 inline group-open:rotate-180" /></summary>
                      <div className="space-y-2 mt-2">
                        <div><div className="flex justify-between text-sm text-muted-foreground"><span>SEO 标题</span><span>{(pageForm.seoTitle || "").length}/70</span></div><Input value={pageForm.seoTitle || ""} onChange={(e) => setPageForm({ ...pageForm, seoTitle: e.target.value })} maxLength={70} className="h-9 text-sm" /></div>
                        <div><div className="flex justify-between text-sm text-muted-foreground"><span>SEO 描述</span><span>{(pageForm.seoDescription || "").length}/320</span></div><textarea value={pageForm.seoDescription || ""} onChange={(e) => setPageForm({ ...pageForm, seoDescription: e.target.value })} maxLength={320} rows={2} className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm resize-none" /></div>
                        <SeoPreview title={pageForm.seoTitle || pageForm.title || ""} handle={pageForm.handle || ""} description={pageForm.seoDescription || ""} shopDomain={shopUrl || shopName} />
                      </div>
                    </details>
                    <div className="flex gap-2"><Button onClick={savePage} className="h-9 bg-amber-600 text-white text-sm flex-1"><Save className="h-3 w-3 mr-1" />保存</Button><Button variant="outline" onClick={() => { setPageExpandedId(null); setPageForm(null); }} className="h-9 text-sm">取消</Button></div>
                  </CardContent>
                )}
              </Card>
            ))}
            {pages.length === 0 && <div className="text-center py-12 text-base text-muted-foreground">暂无页面，点击上方按钮新建</div>}
          </div>
          {/* Page delete confirm */}
          {pageDeleteId !== null && (
            <>
              <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setPageDeleteId(null)} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="bg-card border border-border/40 rounded-xl p-5 max-w-sm space-y-3 shadow-2xl"><AlertCircle className="h-9 w-8 text-red-400" /><p className="text-base font-semibold">确定删除此页面？</p><div className="flex gap-2"><Button onClick={() => deletePage(pageDeleteId)} className="flex-1 bg-red-600 text-white text-sm">删除</Button><Button variant="outline" onClick={() => setPageDeleteId(null)} className="flex-1 text-sm">取消</Button></div></div></div>
            </>
          )}
        </>
      )}

      {/* ══ TAB: Blog Posts ══ */}
      {tab === "blog" && (
        <>
          <div className="flex items-center gap-3">
            <select value={selectedBlogId} onChange={(e) => { setSelectedBlogId(Number(e.target.value)); setArticleExpandedId(null); }} className="h-9 rounded border border-border/40 bg-background px-2 text-sm text-foreground">
              {blogs.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            <Button size="sm" onClick={createArticle} className="h-9 gap-1 bg-purple-600 hover:bg-purple-500 text-white text-sm"><Plus className="h-3 w-3" />新建文章</Button>
          </div>
          <div className="space-y-2">
            {blogArticles.map((a) => (
              <Card key={a.id} className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/20" onClick={() => toggleArticleExpand(a.id)}>
                  {articleExpandedId === a.id ? <ChevronDown className="h-4 w-4 shrink-0 text-purple-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="flex-1 min-w-0"><p className="text-base font-semibold truncate">{a.title}</p><span className="text-xs text-muted-foreground">{a.author} · {a.createdAt ? new Date(a.createdAt).toLocaleDateString("zh-CN") : ""}</span></div>
                  <div className="flex gap-1">{a.tags.slice(0, 2).map((t) => <Badge key={t} variant="outline" className="text-[9px] px-1 py-0">{t}</Badge>)}</div>
                  <Badge className={`text-xs ${a.published ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>{a.published ? "已发布" : "隐藏"}</Badge>
                  <button onClick={(e) => { e.stopPropagation(); setArticleDeleteId(a.id); }} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {articleExpandedId === a.id && articleForm && (
                  <CardContent className="px-5 py-3 border-t border-border/20 space-y-3 animate-[fadeIn_0.15s]">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">标题 *</label><Input value={articleForm.title || ""} onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })} className="h-9 text-sm" /></div>
                      <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">作者</label><Input value={articleForm.author || ""} onChange={(e) => setArticleForm({ ...articleForm, author: e.target.value })} className="h-9 text-sm" /></div>
                    </div>
                    <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">摘要</label><textarea value={articleForm.summaryHtml || ""} onChange={(e) => setArticleForm({ ...articleForm, summaryHtml: e.target.value })} rows={2} className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm resize-none" /></div>
                    <div><label className="text-xs font-semibold text-muted-foreground mb-0.5 block">标签 (逗号分隔)</label>
                      <div className="flex flex-wrap gap-1 mb-1">{(articleForm.tags || []).map((t) => <Badge key={t} className="text-xs px-2 py-0.5 gap-1 bg-zinc-500/15 text-zinc-400">{t}<button onClick={() => setArticleForm({ ...articleForm, tags: (articleForm.tags || []).filter((x) => x !== t) })}><X className="h-2.5 w-2.5" /></button></Badge>)}</div>
                      <Input placeholder="新标签..." className="h-9 text-sm" onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v && !(articleForm.tags || []).includes(v)) setArticleForm({ ...articleForm, tags: [...(articleForm.tags || []), v] }); (e.target as HTMLInputElement).value = ""; } }} />
                    </div>
                    <ContentEditor html={articleForm.bodyHtml || ""} onChange={(v) => setArticleForm({ ...articleForm, bodyHtml: v })} descMode={articleDescMode} setDescMode={setArticleDescMode} />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer"><input type="checkbox" checked={!!articleForm.published} onChange={() => setArticleForm({ ...articleForm, published: !articleForm.published })} className="accent-emerald-500" />已发布</label>
                    <details className="group"><summary className="text-xs font-semibold text-muted-foreground cursor-pointer">SEO <ChevronDown className="h-3 w-3 inline group-open:rotate-180" /></summary>
                      <div className="space-y-2 mt-2">
                        <div><div className="flex justify-between text-sm text-muted-foreground"><span>SEO 标题</span><span>{(articleForm.seoTitle || "").length}/70</span></div><Input value={articleForm.seoTitle || ""} onChange={(e) => setArticleForm({ ...articleForm, seoTitle: e.target.value })} maxLength={70} className="h-9 text-sm" /></div>
                        <div><div className="flex justify-between text-sm text-muted-foreground"><span>SEO 描述</span><span>{(articleForm.seoDescription || "").length}/320</span></div><textarea value={articleForm.seoDescription || ""} onChange={(e) => setArticleForm({ ...articleForm, seoDescription: e.target.value })} maxLength={320} rows={2} className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm resize-none" /></div>
                      </div>
                    </details>
                    <div className="flex gap-2"><Button onClick={saveArticle} className="h-9 bg-purple-600 text-white text-sm flex-1"><Save className="h-3 w-3 mr-1" />保存</Button><Button variant="outline" onClick={() => { setArticleExpandedId(null); setArticleForm(null); }} className="h-9 text-sm">取消</Button></div>
                  </CardContent>
                )}
              </Card>
            ))}
            {blogArticles.length === 0 && <div className="text-center py-12 text-base text-muted-foreground">此博客暂无文章</div>}
          </div>
          {/* Article delete confirm */}
          {articleDeleteId !== null && (
            <>
              <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setArticleDeleteId(null)} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="bg-card border border-border/40 rounded-xl p-5 max-w-sm space-y-3 shadow-2xl"><AlertCircle className="h-9 w-8 text-red-400" /><p className="text-base font-semibold">确定删除此文章？</p><div className="flex gap-2"><Button onClick={() => deleteArticle(articleDeleteId)} className="flex-1 bg-red-600 text-white text-sm">删除</Button><Button variant="outline" onClick={() => setArticleDeleteId(null)} className="flex-1 text-sm">取消</Button></div></div></div>
            </>
          )}
        </>
      )}
    </div>
  );
}
