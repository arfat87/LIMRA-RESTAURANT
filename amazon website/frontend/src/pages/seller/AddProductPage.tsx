import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, X, Plus, Save, Send, Image as ImageIcon } from 'lucide-react'
import { mockCategories } from '@/data/mockData'
import toast from 'react-hot-toast'

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  price: z.coerce.number().positive('Price must be positive'),
  comparePrice: z.coerce.number().optional(),
  category: z.string().min(1, 'Select a category'),
  brand: z.string().optional(),
  stock: z.coerce.number().int().positive('Stock must be positive'),
  status: z.enum(['draft', 'active']),
})
type ProductForm = z.infer<typeof schema>

export default function AddProductPage() {
  const navigate = useNavigate()
  const [images, setImages] = useState<string[]>([])
  const [variants, setVariants] = useState<{ name: string; value: string; price: string }[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'draft', stock: 100 },
  })

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        setImages(prev => [...prev, url])
      }
    })
  }

  const addVariant = () => {
    setVariants(prev => [...prev, { name: 'Color', value: '', price: '0' }])
  }

  const removeVariant = (i: number) => {
    setVariants(prev => prev.filter((_, idx) => idx !== i))
  }

  const onSubmit = (data: any) => {
    console.log('Product data:', data, images, variants)
    toast.success(`Product ${data.status === 'active' ? 'published' : 'saved as draft'}! 🎉`, {
      style: { background: '#1F2937', color: '#fff' },
    })
    navigate('/seller/products')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Add New Product</h1>
          <p className="text-gray-400">Fill in the details to list your product</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic info */}
        <div className="card space-y-4">
          <h2 className="font-bold text-white border-b border-border pb-3">Basic Information</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Product Title *</label>
            <input {...register('title')} placeholder="e.g. Premium Wireless Bluetooth Headphones" className="input" />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message?.toString()}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description *</label>
            <textarea
              {...register('description')}
              placeholder="Describe your product in detail..."
              className="input min-h-[140px] resize-y"
            />
            {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message?.toString()}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Category *</label>
              <select {...register('category')} className="input">
                <option value="">Select category...</option>
                {mockCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              {errors.category && <p className="text-red-400 text-xs mt-1">{errors.category.message?.toString()}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Brand</label>
              <input {...register('brand')} placeholder="e.g. Sony, Apple, Nike" className="input" />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card space-y-4">
          <h2 className="font-bold text-white border-b border-border pb-3">Pricing & Inventory</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Selling Price * ($)</label>
              <input {...register('price')} type="number" step="0.01" placeholder="0.00" className="input" />
              {errors.price && <p className="text-red-400 text-xs mt-1">{errors.price.message?.toString()}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Compare Price ($)</label>
              <input {...register('comparePrice')} type="number" step="0.01" placeholder="0.00" className="input" />
              <p className="text-xs text-gray-500 mt-1">Original price before discount</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Stock Quantity *</label>
              <input {...register('stock')} type="number" placeholder="100" className="input" />
              {errors.stock && <p className="text-red-400 text-xs mt-1">{errors.stock.message?.toString()}</p>}
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="card space-y-4">
          <h2 className="font-bold text-white border-b border-border pb-3">Product Images</h2>
          
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
              isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-gray-500'
            }`}
          >
            <ImageIcon size={48} className="text-gray-600 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">Drop images here or click to upload</p>
            <p className="text-sm text-gray-400 mb-3">PNG, JPG, WEBP up to 10MB each</p>
            <label className="btn-secondary text-sm cursor-pointer">
              <Upload size={16} className="inline mr-2" />
              Choose Files
              <input type="file" multiple accept="image/*" className="hidden" onChange={e => {
                Array.from(e.target.files ?? []).forEach(f => {
                  const url = URL.createObjectURL(f)
                  setImages(prev => [...prev, url])
                })
              }} />
            </label>
          </div>

          {images.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {images.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" />
                  <button
                    type="button"
                    onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} className="text-white" />
                  </button>
                  {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] bg-primary text-secondary px-1 rounded">Primary</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variants */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="font-bold text-white">Variants (Optional)</h2>
            <button type="button" onClick={addVariant} className="btn-outline text-sm py-1.5 flex items-center gap-1">
              <Plus size={14} /> Add Variant
            </button>
          </div>

          {variants.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No variants added. Click "Add Variant" to add colors, sizes, etc.</p>
          )}

          {variants.map((v, i) => (
            <div key={i} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Type</label>
                <select
                  value={v.name}
                  onChange={e => setVariants(prev => prev.map((vv, idx) => idx === i ? { ...vv, name: e.target.value } : vv))}
                  className="input text-sm py-2"
                >
                  <option value="Color">Color</option>
                  <option value="Size">Size</option>
                  <option value="Material">Material</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Value</label>
                <input
                  value={v.value}
                  onChange={e => setVariants(prev => prev.map((vv, idx) => idx === i ? { ...vv, value: e.target.value } : vv))}
                  placeholder="e.g. Red, XL"
                  className="input text-sm py-2"
                />
              </div>
              <div className="w-28">
                <label className="block text-xs text-gray-400 mb-1">Price Modifier</label>
                <input
                  value={v.price}
                  onChange={e => setVariants(prev => prev.map((vv, idx) => idx === i ? { ...vv, price: e.target.value } : vv))}
                  placeholder="+0.00"
                  className="input text-sm py-2"
                />
              </div>
              <button type="button" onClick={() => removeVariant(i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg mb-0.5">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Status & Submit */}
        <div className="card">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Publication Status</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input {...register('status')} type="radio" value="draft" className="accent-primary" />
                  <span className="text-sm text-gray-300">Save as Draft</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input {...register('status')} type="radio" value="active" className="accent-primary" />
                  <span className="text-sm text-gray-300">Publish Now</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <motion.button
                type="submit"
                name="draft"
                whileTap={{ scale: 0.97 }}
                className="btn-secondary flex items-center gap-2"
                onClick={() => {}}
              >
                <Save size={18} /> Save Draft
              </motion.button>
              <motion.button
                type="submit"
                whileTap={{ scale: 0.97 }}
                className="btn-primary flex items-center gap-2"
              >
                <Send size={18} /> Publish Product
              </motion.button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
