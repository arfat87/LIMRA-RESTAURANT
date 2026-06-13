import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, X, Plus, ArrowLeft, ImagePlus, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import { adminProductApi } from '../../api/admin.api';
import { categoryApi } from '../../api/category.api';
import { QUERY_KEYS } from '../../constants/queryKeys';
import { ROUTES } from '../../constants/routes';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';
import type { Category } from '../../types/product.types';

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.coerce.number().min(1, 'Price is required'),
  mrp: z.coerce.number().min(1, 'MRP is required'),
  stock: z.coerce.number().min(0, 'Stock cannot be negative'),
  condition: z.enum(['NEW', 'SECOND_HAND', 'REFURBISHED']),
  categoryId: z.string().min(1, 'Please select a category'),
  brand: z.string().optional(),
  model: z.string().optional(),
  isFeatured: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

const CONDITION_LABELS = { NEW: 'New', SECOND_HAND: 'Second Hand', REFURBISHED: 'Refurbished' };

const AdminProductForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: [QUERY_KEYS.CATEGORIES],
    queryFn: () => categoryApi.getAll().then((r) => r.data.data || []),
  });

  const { data: existingProduct } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => api.get(`/products/id/${id}`).then((r) => r.data.data),
    enabled: isEditing,
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { condition: 'NEW', isFeatured: false, stock: 0 },
  });

  useEffect(() => {
    if (existingProduct) {
      reset({
        name: existingProduct.name,
        description: existingProduct.description,
        price: existingProduct.price,
        mrp: existingProduct.mrp,
        stock: existingProduct.stock,
        condition: existingProduct.condition,
        categoryId: existingProduct.categoryId,
        brand: existingProduct.brand || '',
        model: existingProduct.model || '',
        isFeatured: existingProduct.isFeatured,
      });
      setImageUrls(existingProduct.images || []);
    }
  }, [existingProduct, reset]);

  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) { toast.error('Please enter a valid URL'); return; }
    setImageUrls((prev) => [...prev, url]);
    setImageUrlInput('');
  };

  const removeImageUrl = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadFiles((prev) => [...prev, ...files]);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (formData: FormData) => {
    const allImages = [...imageUrls];
    if (allImages.length === 0 && uploadFiles.length === 0) {
      toast.error('Please add at least one product image');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = { ...formData, images: allImages };
      let productId = id;

      if (isEditing) {
        await adminProductApi.update(id!, payload);
        toast.success('Product updated!');
      } else {
        const res = await adminProductApi.create(payload);
        productId = (res.data as { data?: { id?: string } })?.data?.id;
        toast.success('Product created!');
      }

      // Upload file images if any
      if (uploadFiles.length > 0 && productId) {
        const fileList = { length: uploadFiles.length, item: (i: number) => uploadFiles[i], ...uploadFiles } as unknown as FileList;
        await adminProductApi.uploadImages(productId, fileList);
      }

      navigate(ROUTES.ADMIN_PRODUCTS);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFeatured = watch('isFeatured');

  return (
    <>
      <Helmet>
        <title>{isEditing ? 'Edit Product' : 'Add Product'} | Admin | DSLR WORLD</title>
      </Helmet>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(ROUTES.ADMIN_PRODUCTS)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-poppins font-bold text-2xl text-midnight">
              {isEditing ? 'Edit Product' : 'Add New Product'}
            </h1>
            <p className="text-sm text-gray-500">
              {isEditing ? 'Update the product details below' : 'Fill in all required fields to add a product'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
                <h2 className="font-poppins font-semibold text-gray-800">Basic Information</h2>
                <Input label="Product Name" required error={errors.name?.message} {...register('name')} placeholder="e.g. Canon EOS 1500D DSLR Camera" />
                <div>
                  <label className="text-sm font-medium text-gray-700 font-poppins mb-1.5 block">
                    Description <span className="text-accent">*</span>
                  </label>
                  <textarea
                    {...register('description')}
                    rows={5}
                    placeholder="Write a detailed description of the product..."
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm font-inter resize-none outline-none transition-all ${
                      errors.description ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-accent focus:ring-2 focus:ring-accent/20'
                    }`}
                  />
                  {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Brand" placeholder="e.g. Canon" {...register('brand')} />
                  <Input label="Model" placeholder="e.g. EOS 1500D" {...register('model')} />
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
                <h2 className="font-poppins font-semibold text-gray-800">Pricing & Stock</h2>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Sale Price (₹)" required type="number" min={0} error={errors.price?.message}
                    {...register('price')} placeholder="45000" helper="Amount customer pays" />
                  <Input label="MRP (₹)" required type="number" min={0} error={errors.mrp?.message}
                    {...register('mrp')} placeholder="55000" helper="Original list price" />
                  <Input label="Stock Quantity" required type="number" min={0} error={errors.stock?.message}
                    {...register('stock')} placeholder="10" />
                </div>
              </div>

              {/* Images */}
              <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
                <h2 className="font-poppins font-semibold text-gray-800">Product Images</h2>

                {/* URL input */}
                <div>
                  <label className="text-sm font-medium text-gray-700 font-poppins mb-1.5 block">Add Image via URL</label>
                  <div className="flex gap-2">
                    <input
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                    />
                    <Button type="button" variant="outline" onClick={addImageUrl} leftIcon={<Plus size={14} />}>Add</Button>
                  </div>
                </div>

                {/* File upload */}
                <div>
                  <label className="text-sm font-medium text-gray-700 font-poppins mb-1.5 block">
                    Or Upload Files (Cloudinary)
                  </label>
                  <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-accent transition-colors">
                    <ImagePlus size={24} className="text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Click to upload images</p>
                    <p className="text-xs text-gray-400">PNG, JPG up to 10MB each</p>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                  </label>
                </div>

                {/* Previews — URL images */}
                {imageUrls.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">URL Images ({imageUrls.length})</p>
                    <div className="flex flex-wrap gap-3">
                      {imageUrls.map((url, i) => (
                        <div key={i} className="relative group w-20 h-20">
                          <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-gray-200" />
                          <button type="button" onClick={() => removeImageUrl(i)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={12} />
                          </button>
                          {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-accent text-white text-[9px] text-center py-0.5 rounded-b-xl font-bold">Main</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previews — uploaded files */}
                {uploadPreviews.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Files to Upload ({uploadPreviews.length})</p>
                    <div className="flex flex-wrap gap-3">
                      {uploadPreviews.map((src, i) => (
                        <div key={i} className="relative group w-20 h-20">
                          <img src={src} alt="" className="w-full h-full object-cover rounded-xl border border-gray-200" />
                          <button type="button" onClick={() => removeUploadFile(i)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Category & Condition */}
              <div className="bg-white rounded-2xl shadow-card p-5 space-y-4">
                <h2 className="font-poppins font-semibold text-gray-800">Classification</h2>
                <div>
                  <label className="text-sm font-medium text-gray-700 font-poppins mb-1.5 block">
                    Category <span className="text-accent">*</span>
                  </label>
                  <select {...register('categoryId')}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all ${
                      errors.categoryId ? 'border-red-400' : 'border-gray-300'
                    }`}>
                    <option value="">Select Category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 font-poppins mb-1.5 block">
                    Condition <span className="text-accent">*</span>
                  </label>
                  <div className="space-y-2">
                    {(Object.keys(CONDITION_LABELS) as Array<keyof typeof CONDITION_LABELS>).map((cond) => (
                      <label key={cond} className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                        <input type="radio" value={cond} {...register('condition')} className="accent-accent" />
                        <span className="text-sm text-gray-700">{CONDITION_LABELS[cond]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="bg-white rounded-2xl shadow-card p-5">
                <h2 className="font-poppins font-semibold text-gray-800 mb-4">Options</h2>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Featured Product</p>
                    <p className="text-xs text-gray-500">Show on homepage</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue('isFeatured', !isFeatured)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${isFeatured ? 'bg-accent' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isFeatured ? 'translate-x-5' : ''}`} />
                  </button>
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={isSubmitting}
                leftIcon={isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              >
                {isEditing ? 'Update Product' : 'Add Product'}
              </Button>
              <Button type="button" variant="ghost" fullWidth onClick={() => navigate(ROUTES.ADMIN_PRODUCTS)}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default AdminProductForm;
