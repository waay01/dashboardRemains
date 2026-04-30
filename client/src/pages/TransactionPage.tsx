import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '../types';
import { getTransactions } from '../api/transactions';
import TransactionForm from '../components/TransactionForm';
import BalancePanel from '../components/BalancePanel';

interface TransactionPageProps {
  type: 'incoming' | 'outgoing';
}

export default function TransactionPage({ type }: TransactionPageProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTransactions({
        type,
        date: dateFilter || undefined,
        page,
        limit: 30,
      });
      setTransactions(res.items);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [type, dateFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [type]);

  const handleCreated = () => {
    setShowForm(false);
    fetchData();
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const title = type === 'incoming' ? 'Приход товара' : 'Выдача товара';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          {showForm ? 'Закрыть форму' : `+ Новый ${type === 'incoming' ? 'приход' : 'выдача'}`}
        </button>
      </div>

      {showForm && (
        <div className="mb-6">
          <TransactionForm type={type} onCreated={handleCreated} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-gray-600">Фильтр по дате:</label>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setPage(1);
          }}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
        />
        {dateFilter && (
          <button
            onClick={() => {
              setDateFilter('');
              setPage(1);
            }}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Сбросить
          </button>
        )}
        <span className="text-sm text-gray-500 ml-auto">Всего: {total}</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase">Номер документа</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase">Водитель</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase">Контрагент</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase">Дата</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase">Позиций</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase">Общ. кол-во</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">Загрузка...</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">Нет документов</td>
              </tr>
            ) : (
              transactions.map((t) => (
                <>
                  <tr
                    key={t.id}
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2 font-medium">{t.documentNumber}</td>
                    <td className="px-3 py-2 text-gray-600">{t.driverName || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{t.counterparty || '—'}</td>
                    <td className="px-3 py-2">{formatDate(t.date)}</td>
                    <td className="px-3 py-2 text-right">{t.itemCount}</td>
                    <td className="px-3 py-2 text-right font-medium">{t.totalQuantity}</td>
                  </tr>
                  {expandedId === t.id && t.items.length > 0 && (
                    <tr key={`${t.id}-items`}>
                      <td colSpan={6} className="bg-blue-50 px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1">Ячейка</th>
                              <th className="text-left py-1">Товар</th>
                              <th className="text-left py-1">Артикул</th>
                              <th className="text-right py-1">Кол-во</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.items.map((item, idx) => (
                              <tr key={idx} className="border-t border-blue-100">
                                <td className="py-1 font-mono">{item.cellAddress}</td>
                                <td className="py-1">{item.productName}</td>
                                <td className="py-1 font-mono text-gray-500">{item.article || ''}</td>
                                <td className="py-1 text-right font-medium">{item.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">Стр. {page} из {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 transition"
            >
              Назад
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 transition"
            >
              Вперёд
            </button>
          </div>
        </div>
      )}

      <BalancePanel />
    </div>
  );
}
