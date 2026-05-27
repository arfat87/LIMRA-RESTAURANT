import { useSearchParams } from 'react-router-dom'
import ProductListingPage from './ProductListingPage'
import { Search, Mic } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [inputVal, setInputVal] = useState(q)
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputVal.trim()) navigate(`/search?q=${encodeURIComponent(inputVal.trim())}`)
  }

  const suggestions = ['wireless headphones', 'gaming laptop', 'smart watch', 'running shoes', 'coffee maker']

  return (
    <div>
      {/* Search bar hero */}
      <div className="bg-gradient-to-b from-secondary to-[#131921] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Search products..."
                className="input pl-10 pr-12"
                autoFocus
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary">
                <Mic size={18} />
              </button>
            </div>
            <button type="submit" className="btn-primary px-6">Search</button>
          </form>

          {!q && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-500">Popular:</span>
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => { setInputVal(s); navigate(`/search?q=${encodeURIComponent(s)}`) }}
                  className="text-xs text-primary hover:text-primary-400 underline transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reuse product listing page logic */}
      <ProductListingPage />
    </div>
  )
}
