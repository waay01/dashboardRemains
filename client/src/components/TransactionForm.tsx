import { useState, useRef, useEffect, FormEvent } from 'react';
import { Product, CreateTransactionPayload } from '../types';
import { searchProducts, createTransaction } from '../api/transactions';

interface TransactionFormProps {
  type: 'incoming' | 'outgoing';
  onCreated: () => void;
  onCancel: () => void;
}

interface ItemRow {
  cellAddress: string;
  productId: number | null;
  productLabel: string;
  quantity: number;
}

export default function TransactionForm({ type, onCreated, onCancel }: TransactionFormProps) {
  const [docNumber, setDocNumber] = useState('');
  const [driver, setDriver] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ItemRow[]>([
    { cellAddress: '', productId: null, productLabel: '', quantity: 1 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductResults([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchProducts(productSearch);
        setProductResults(results);
      } catch {
        setProductResults([]);
      }
    }, 300);
  }, [productSearch]);

  const updateItem = (idx: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { cellAddress: '', productId: null, productLabel: '', quantity: 1 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectProduct = (idx: number, product: Product) => {
    updateItem(idx, 'productId', product.id);
    updateItem(idx, 'productLabel', `${product.name} (${product.article || ''})`);
    setProductSearch('');
    setProductResults([]);
    setActiveItemIdx(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const validItems = items.filter((i) => i.cellAddress && i.productId && i.quantity > 0);
    if (!validItems.length) {
      setError('Добавьте хотя бы одну позицию с ячейкой, товаром и количеством');
      return;
    }

    setSaving(true);
    try {
      const payload: CreateTransactionPayload = {
        type,
        documentNumber: docNumber,
        driverName: driver,
        counterparty,
        date,
        items: validItems.map((i) => ({
          cellAddress: i.cellAddress,
          productId: i.productId!,
          quantity: i.quantity,
        })),
      };
      await createTransaction(payload);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">
        {type === 'incoming' ? 'Новый приход' : 'Новая выдача'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Номер документа *</label>
            <input
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Водитель</label>
            <input
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Контрагент</label>
            <input
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Позиции</label>
            <button
              type="button"
              onClick={addItem}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Добавить позицию
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="w-40">
                  <input
                    placeholder="Ячейка (S-01-01-01)"
                    value={item.cellAddress}
                    onChange={(e) => updateItem(idx, 'cellAddress', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex-1 relative">
                  <input
                    placeholder="Товар (поиск по названию или артикулу)"
                    value={activeItemIdx === idx ? productSearch : item.productLabel}
                    onFocus={() => {
                      setActiveItemIdx(idx);
                      setProductSearch(item.productLabel);
                    }}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setActiveItemIdx(idx);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setActiveItemIdx(null);
                        setProductResults([]);
                      }, 200);
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  {activeItemIdx === idx && productResults.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                      {productResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectProduct(idx, p);
                          }}
                        >
                          <span className="font-medium">{p.name}</span>
                          {p.article && (
                            <span className="text-gray-400 ml-2 text-xs">{p.article}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    min={1}
                    placeholder="Кол-во"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="px-2 py-1.5 text-gray-400 hover:text-red-500 transition"
                  title="Удалить"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
