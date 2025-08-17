"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Upload, Download } from "lucide-react";

interface Theme {
  id: string;
  name: string;
  description: string;
  category_id: string;
  preview_images: string[];
  preview_video_url: string;
  theme_data: any;
  components: any;
  animations: any;
  effects_3d: any;
  price_coins: number;
  price_usd: number;
  rarity: string;
  is_premium: boolean;
  is_seasonal: boolean;
  season_start?: string;
  season_end?: string;
  download_count: number;
  rating_average: number;
  rating_count: number;
  tags: string[];
  creator_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ThemeCategory {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export function ThemeManagement() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [categories, setCategories] = useState<ThemeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const { toast } = useToast();

  const [newTheme, setNewTheme] = useState({
    name: "",
    description: "",
    category_id: "",
    preview_images: [] as string[],
    preview_video_url: "",
    theme_data: {},
    components: {},
    animations: {},
    effects_3d: {},
    price_coins: 0,
    price_usd: 0,
    rarity: "common",
    is_premium: false,
    is_seasonal: false,
    tags: [] as string[],
  });

  useEffect(() => {
    fetchThemes();
    fetchCategories();
  }, []);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from your API
      // For now, we'll use mock data
      const mockThemes: Theme[] = [
        {
          id: "1",
          name: "Gojo Satoru",
          description: "Unleash the power of the Six Eyes with this stunning Jujutsu Kaisen inspired theme",
          category_id: "anime",
          preview_images: ["/themes/gojo-preview-1.jpg", "/themes/gojo-preview-2.jpg"],
          preview_video_url: "/themes/gojo-preview.mp4",
          theme_data: {},
          components: {},
          animations: {},
          effects_3d: {},
          price_coins: 500,
          price_usd: 4.99,
          rarity: "legendary",
          is_premium: true,
          is_seasonal: false,
          download_count: 15420,
          rating_average: 4.9,
          rating_count: 1247,
          tags: ["anime", "jujutsu-kaisen", "blue", "glow", "premium"],
          creator_id: "system",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: "2",
          name: "Cyberpunk 2077",
          description: "Experience Night City with this futuristic neon-soaked theme",
          category_id: "gaming",
          preview_images: ["/themes/cyberpunk-preview-1.jpg", "/themes/cyberpunk-preview-2.jpg"],
          preview_video_url: "/themes/cyberpunk-preview.mp4",
          theme_data: {},
          components: {},
          animations: {},
          effects_3d: {},
          price_coins: 400,
          price_usd: 3.99,
          rarity: "epic",
          is_premium: true,
          is_seasonal: false,
          download_count: 12350,
          rating_average: 4.8,
          rating_count: 892,
          tags: ["gaming", "cyberpunk", "neon", "yellow", "futuristic"],
          creator_id: "system",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      setThemes(mockThemes);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load themes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      // In a real implementation, this would fetch from your API
      // For now, we'll use mock data
      const mockCategories: ThemeCategory[] = [
        {
          id: "anime",
          name: "Anime",
          description: "Anime-inspired themes",
          icon_url: "🎨",
          sort_order: 1,
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: "gaming",
          name: "Gaming",
          description: "Gaming-themed designs",
          icon_url: "🎮",
          sort_order: 2,
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: "nature",
          name: "Nature",
          description: "Nature-inspired themes",
          icon_url: "🌿",
          sort_order: 3,
          is_active: true,
          created_at: new Date().toISOString()
        }
      ];
      setCategories(mockCategories);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    }
  };

  const createTheme = async () => {
    try {
      // In a real implementation, this would make an API call
      toast({
        title: "Success",
        description: "Theme created successfully",
      });
      setShowCreateDialog(false);
      resetForm();
      fetchThemes(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create theme",
        variant: "destructive",
      });
    }
  };

  const updateTheme = async (theme: Theme) => {
    try {
      // In a real implementation, this would make an API call
      toast({
        title: "Success",
        description: "Theme updated successfully",
      });
      setEditingTheme(null);
      fetchThemes(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update theme",
        variant: "destructive",
      });
    }
  };

  const deleteTheme = async (themeId: string) => {
    try {
      // In a real implementation, this would make an API call
      toast({
        title: "Success",
        description: "Theme deleted successfully",
      });
      fetchThemes(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete theme",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setNewTheme({
      name: "",
      description: "",
      category_id: "",
      preview_images: [],
      preview_video_url: "",
      theme_data: {},
      components: {},
      animations: {},
      effects_3d: {},
      price_coins: 0,
      price_usd: 0,
      rarity: "common",
      is_premium: false,
      is_seasonal: false,
      tags: [],
    });
  };

  const handleAddTag = (tag: string) => {
    if (tag && !newTheme.tags.includes(tag)) {
      setNewTheme({
        ...newTheme,
        tags: [...newTheme.tags, tag]
      });
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewTheme({
      ...newTheme,
      tags: newTheme.tags.filter(t => t !== tag)
    });
  };

  if (loading) {
    return <div className="text-center py-8">Loading themes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Theme Management</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Theme
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Theme</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Theme Name</Label>
                <Input
                  id="name"
                  value={newTheme.name}
                  onChange={(e) => setNewTheme({...newTheme, name: e.target.value})}
                  placeholder="Enter theme name"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTheme.description}
                  onChange={(e) => setNewTheme({...newTheme, description: e.target.value})}
                  placeholder="Enter theme description"
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={newTheme.category_id} onValueChange={(value) => setNewTheme({...newTheme, category_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="rarity">Rarity</Label>
                <Select value={newTheme.rarity} onValueChange={(value) => setNewTheme({...newTheme, rarity: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rarity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="common">Common</SelectItem>
                    <SelectItem value="rare">Rare</SelectItem>
                    <SelectItem value="epic">Epic</SelectItem>
                    <SelectItem value="legendary">Legendary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="price_coins">Price (Coins)</Label>
                <Input
                  id="price_coins"
                  type="number"
                  value={newTheme.price_coins}
                  onChange={(e) => setNewTheme({...newTheme, price_coins: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>
              
              <div>
                <Label htmlFor="price_usd">Price (USD)</Label>
                <Input
                  id="price_usd"
                  type="number"
                  step="0.01"
                  value={newTheme.price_usd}
                  onChange={(e) => setNewTheme({...newTheme, price_usd: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newTheme.tags.map((tag, index) => (
                    <div key={index} className="bg-primary/10 px-2 py-1 rounded-full text-sm flex items-center">
                      {tag}
                      <button 
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-primary hover:text-primary/80"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input 
                    id="tag-input"
                    placeholder="Add a tag"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        handleAddTag(input.value.trim());
                        input.value = '';
                      }
                    }}
                  />
                  <Button 
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('tag-input') as HTMLInputElement;
                      if (input?.value.trim()) {
                        handleAddTag(input.value.trim());
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_premium"
                  checked={newTheme.is_premium}
                  onChange={(e) => setNewTheme({...newTheme, is_premium: e.target.checked})}
                />
                <Label htmlFor="is_premium">Premium Theme</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_seasonal"
                  checked={newTheme.is_seasonal}
                  onChange={(e) => setNewTheme({...newTheme, is_seasonal: e.target.checked})}
                />
                <Label htmlFor="is_seasonal">Seasonal Theme</Label>
              </div>
              
              <Button onClick={createTheme} className="w-full">
                Create Theme
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map((theme) => (
          <Card key={theme.id} className="overflow-hidden">
            <div className="h-40 bg-gradient-to-r from-primary/20 to-secondary/20 relative">
              {theme.preview_images?.[0] ? (
                <img 
                  src={theme.preview_images[0]} 
                  alt={theme.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-4xl">🎨</div>
                </div>
              )}
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                {theme.rarity}
              </div>
            </div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{theme.name}</CardTitle>
                <div className="flex space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setEditingTheme(theme)}>
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteTheme(theme.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{theme.price_coins} coins</div>
                  <div className="text-sm text-gray-500">${theme.price_usd}</div>
                </div>
                <div className="text-sm">
                  <div>Downloads: {theme.download_count}</div>
                  <div>Rating: {theme.rating_average} ({theme.rating_count})</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {theme.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="bg-primary/10 px-2 py-1 rounded-full text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {themes.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-4xl mb-4">🎨</div>
            <h3 className="text-xl font-semibold mb-2">No Themes Found</h3>
            <p className="text-gray-600 mb-4">Create your first theme to get started!</p>
            <Button onClick={() => setShowCreateDialog(true)}>Create First Theme</Button>
          </CardContent>
        </Card>
      )}
      
      {/* Edit Theme Dialog */}
      <Dialog open={!!editingTheme} onOpenChange={() => setEditingTheme(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Theme</DialogTitle>
          </DialogHeader>
          {editingTheme && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Theme Name</Label>
                <Input
                  id="edit-name"
                  value={editingTheme.name}
                  onChange={(e) => setEditingTheme({...editingTheme, name: e.target.value})}
                  placeholder="Enter theme name"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingTheme.description}
                  onChange={(e) => setEditingTheme({...editingTheme, description: e.target.value})}
                  placeholder="Enter theme description"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select value={editingTheme.category_id} onValueChange={(value) => setEditingTheme({...editingTheme, category_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-rarity">Rarity</Label>
                <Select value={editingTheme.rarity} onValueChange={(value) => setEditingTheme({...editingTheme, rarity: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rarity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="common">Common</SelectItem>
                    <SelectItem value="rare">Rare</SelectItem>
                    <SelectItem value="epic">Epic</SelectItem>
                    <SelectItem value="legendary">Legendary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-price_coins">Price (Coins)</Label>
                <Input
                  id="edit-price_coins"
                  type="number"
                  value={editingTheme.price_coins}
                  onChange={(e) => setEditingTheme({...editingTheme, price_coins: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-price_usd">Price (USD)</Label>
                <Input
                  id="edit-price_usd"
                  type="number"
                  step="0.01"
                  value={editingTheme.price_usd}
                  onChange={(e) => setEditingTheme({...editingTheme, price_usd: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is_premium"
                  checked={editingTheme.is_premium}
                  onChange={(e) => setEditingTheme({...editingTheme, is_premium: e.target.checked})}
                />
                <Label htmlFor="edit-is_premium">Premium Theme</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is_active"
                  checked={editingTheme.is_active}
                  onChange={(e) => setEditingTheme({...editingTheme, is_active: e.target.checked})}
                />
                <Label htmlFor="edit-is_active">Active Theme</Label>
              </div>
              
              <Button onClick={() => updateTheme(editingTheme)} className="w-full">
                Update Theme
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
