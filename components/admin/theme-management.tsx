"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";

interface Theme {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  theme_data: any;
  tags: string[];
  price_coins: number;
  price_usd: number;
  download_count: number;
  rating_average: number;
  rating_count: number;
  is_featured: boolean;
  is_active: boolean;
  is_premium: boolean;
  rarity: string;
  created_at: string;
  updated_at: string;
}

interface ThemeCategory {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const RARITIES = ["common", "rare", "epic", "legendary"];

function emptyForm() {
  return {
    name: "",
    description: "",
    category_id: "",
    rarity: "common",
    price_coins: 0,
    price_usd: 0,
    tags: [] as string[],
    preview_url: "",
    thumbnail_url: "",
    is_premium: false,
    is_featured: false,
    is_active: true,
  };
}

export function ThemeManagement() {
  const { getAuthHeader } = useAuth();
  const { toast } = useToast();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [categories, setCategories] = useState<ThemeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [tagInput, setTagInput] = useState("");

  const fetchThemes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/themes", { headers: getAuthHeader(), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load themes");
      setThemes(data.themes || []);
      if (Array.isArray(data.categories)) setCategories(data.categories);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load themes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, toast]);

  useEffect(() => {
    void fetchThemes();
  }, [fetchThemes]);

  const openCreate = () => {
    setForm(emptyForm());
    setTagInput("");
    setShowCreateDialog(true);
  };

  const openEdit = (theme: Theme) => {
    setForm({
      name: theme.name || "",
      description: theme.description || "",
      category_id: theme.category_id || "",
      rarity: theme.rarity || "common",
      price_coins: Number(theme.price_coins || 0),
      price_usd: Number(theme.price_usd || 0),
      tags: Array.isArray(theme.tags) ? theme.tags : [],
      preview_url: theme.preview_url || "",
      thumbnail_url: theme.thumbnail_url || "",
      is_premium: Boolean(theme.is_premium),
      is_featured: Boolean(theme.is_featured),
      is_active: theme.is_active !== false,
    });
    setTagInput("");
    setEditingTheme(theme);
  };

  const submit = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category_id: form.category_id || null,
        rarity: form.rarity,
        price_coins: Number(form.price_coins) || 0,
        price_usd: Number(form.price_usd) || 0,
        tags: form.tags,
        preview_url: form.preview_url.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        is_premium: form.is_premium,
        is_featured: form.is_featured,
        is_active: form.is_active,
      };
      const url = editingTheme
        ? `/api/admin/themes`
        : `/api/admin/themes`;
      const method = editingTheme ? "PUT" : "POST";
      const body = editingTheme ? { ...payload, id: editingTheme.id } : payload;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Save failed");
      toast({ title: editingTheme ? "Theme updated" : "Theme created", description: editingTheme ? "Changes saved." : "Theme is live in the shop." });
      setShowCreateDialog(false);
      setEditingTheme(null);
      await fetchThemes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save theme", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeTheme = async (theme: Theme) => {
    if (!window.confirm(`Delete "${theme.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/themes?id=${theme.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
      toast({ title: "Theme deleted", description: `"${theme.name}" was removed.` });
      await fetchThemes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete theme", variant: "destructive" });
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (tag && !form.tags.includes(tag)) setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    setTagInput("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading themes…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Theme Management</h2>
          <p className="text-sm text-muted-foreground">
            {themes.length} theme{themes.length === 1 ? "" : "s"} · {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Create Theme
        </Button>
      </div>

      {themes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="mb-4 text-4xl">🎨</div>
            <h3 className="mb-2 text-xl font-semibold">No themes yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">Create your first theme — it appears in the shop immediately.</p>
            <Button onClick={openCreate}>Create First Theme</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <Card key={theme.id} className="overflow-hidden">
              <div className="relative h-40 bg-gradient-to-r from-primary/20 to-secondary/20">
                {theme.thumbnail_url || theme.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={theme.thumbnail_url || theme.preview_url || ""}
                    alt={theme.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl">🎨</div>
                )}
                <div className="absolute right-2 top-2 flex gap-1">
                  {theme.is_premium && (
                    <span className="rounded bg-amber-500/90 px-2 py-1 text-xs font-bold text-white">PRO</span>
                  )}
                  <span className="rounded bg-black/50 px-2 py-1 text-xs capitalize text-white">{theme.rarity}</span>
                </div>
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{theme.name}</CardTitle>
                  <div className="flex space-x-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(theme)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => void removeTheme(theme)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{theme.description || "No description"}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{Number(theme.price_coins || 0).toLocaleString()} coins</div>
                    <div className="text-sm text-muted-foreground">${Number(theme.price_usd || 0).toFixed(2)}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{Number(theme.download_count || 0).toLocaleString()} downloads</div>
                    <div>
                      {Number(theme.rating_average || 0).toFixed(1)} ★ ({Number(theme.rating_count || 0).toLocaleString()})
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(theme.tags || []).slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-primary/10 px-2 py-1 text-xs">#{tag}</span>
                  ))}
                  {!theme.is_active && (
                    <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">Inactive</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showCreateDialog || Boolean(editingTheme)} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingTheme(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTheme ? `Edit ${editingTheme.name}` : "Create New Theme"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="theme-name">Theme Name *</Label>
              <Input id="theme-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Neon Nights" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="theme-desc">Description</Label>
              <Textarea id="theme-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What makes this theme special?" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(value) => setForm({ ...form, category_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.icon_url ? `${category.icon_url} ` : ""}{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rarity</Label>
              <Select value={form.rarity} onValueChange={(value) => setForm({ ...form, rarity: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RARITIES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="price-coins">Price (Coins)</Label>
              <Input id="price-coins" type="number" min={0} value={form.price_coins} onChange={(e) => setForm({ ...form, price_coins: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label htmlFor="price-usd">Price (USD)</Label>
              <Input id="price-usd" type="number" min={0} step="0.01" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="theme-thumb">Thumbnail URL</Label>
              <Input id="theme-thumb" value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://…/thumbnail.jpg" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="theme-preview">Preview URL (optional)</Label>
              <Input id="theme-preview" value={form.preview_url} onChange={(e) => setForm({ ...form, preview_url: e.target.value })} placeholder="https://…/preview.jpg" />
            </div>
            <div className="sm:col-span-2">
              <Label>Tags</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="flex items-center rounded-full bg-primary/10 px-2 py-1 text-sm">
                    #{tag}
                    <button onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })} className="ml-2 text-primary hover:text-primary/80">×</button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="Add a tag" />
                <Button type="button" variant="outline" onClick={addTag}>Add</Button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
              <Label htmlFor="is-premium">Premium-only theme</Label>
              <Switch id="is-premium" checked={form.is_premium} onCheckedChange={(checked) => setForm({ ...form, is_premium: checked })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
              <Label htmlFor="is-featured">Featured in shop</Label>
              <Switch id="is-featured" checked={form.is_featured} onCheckedChange={(checked) => setForm({ ...form, is_featured: checked })} />
            </div>
            {editingTheme && (
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                <Label htmlFor="is-active">Active (visible in shop)</Label>
                <Switch id="is-active" checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingTheme(null); }}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={!form.name.trim() || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingTheme ? "Save Changes" : "Create Theme"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
