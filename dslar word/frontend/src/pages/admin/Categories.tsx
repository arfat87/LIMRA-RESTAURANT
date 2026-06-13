import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, FolderOpen, X, Check } from 'lucide-react';
import { adminCategoryApi } from '../../api/admin.api';
import { QUERY_KEYS } from '../../constants/queryKeys';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import type { Category } from '../../types/product.types';

interface CategoryForm {
  name: string;
  description: string;
  image: string;
}

const EMPTY_FORM: CategoryForm = { name: '', description: '', image: '' };

const AdminCategories: React.FC = () => {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: [QUERY_KEYS.CATEGORIES],
    queryFn: () => adminCategoryApi.getAll().then((r) => r.data.data || []),
  });

  const createMutation = useMutation({
    mutationFn: (data: CategoryForm) => adminCategoryApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
      toast.success('Category created!');
      closeModal();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to create category');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryForm }) => adminCategoryApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
      toast.success('Category updated!');
      closeModal();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to update category');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCategoryApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
      toast.success('Category deleted');
      setDeleteConfirmId(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Cannot delete — category may have products');
    },
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, description: cat.description || '', image: cat.image || '' });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Category name is required'); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Helmet><title>Categories | Admin | DSLR WORLD</title></Helmet>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-poppins font-bold text-2xl text-midnight">Categories</h1>
            <p className="text-sm text-gray-500 mt-0.5">{categories.length} categories total</p>
          </div>
          <Button leftIcon={<Plus size={16} />} onClick={openAdd}>Add Category</Button>
        </div>

        {/* Grid of categories */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-card p-4 animate-pulse">
                <div className="w-full h-32 bg-gray-100 rounded-xl mb-3" />
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-card p-16 text-center">
            <FolderOpen size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="font-poppins font-semibold text-gray-600 mb-1">No categories yet</h3>
            <p className="text-gray-400 text-sm mb-4">Add your first category to start organizing products</p>
            <Button onClick={openAdd} leftIcon={<Plus size={14} />}>Add First Category</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white rounded-2xl shadow-card overflow-hidden group hover:shadow-lg transition-shadow">
                {/* Image */}
                <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center overflow-hidden">
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                  ) : (
                    <FolderOpen size={36} className="text-gray-300" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-poppins font-semibold text-gray-800 mb-0.5 line-clamp-1">{cat.name}</h3>
                  <p className="text-xs text-gray-500 mb-1">{cat.slug}</p>
                  {cat._count && (
                    <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
                      {cat._count.products} products
                    </span>
                  )}
                  <div className="flex items-center gap-1 mt-3">
                    <button
                      onClick={() => openEdit(cat)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    {deleteConfirmId === cat.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <button
                          onClick={() => deleteMutation.mutate(cat.id)}
                          className="flex-1 flex items-center justify-center py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="flex-1 flex items-center justify-center py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(cat.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editingId ? 'Edit Category' : 'Add Category'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name"
            required
            placeholder="e.g. DSLR Cameras"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div>
            <label className="text-sm font-medium text-gray-700 font-poppins mb-1.5 block">Description</label>
            <textarea
              rows={3}
              placeholder="Brief description of this category..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm resize-none outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          <Input
            label="Image URL"
            placeholder="https://example.com/category-image.jpg"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            helper="Paste a direct link to an image"
          />
          {form.image && (
            <div className="rounded-xl overflow-hidden h-32 bg-gray-50">
              <img src={form.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" fullWidth onClick={closeModal}>Cancel</Button>
            <Button type="submit" fullWidth loading={isSaving}>
              {editingId ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AdminCategories;
