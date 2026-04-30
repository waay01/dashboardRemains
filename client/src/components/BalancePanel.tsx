import { useState, useEffect } from 'react';
import { BalanceItem } from '../types';
import { getBalance } from '../api/transactions';

export default function BalancePanel() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const result = await getBalance({ from: from || undefined, to: to || undefined });
      setData(result);
      setFetched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (from || to) fetchBalance();
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mt-6">
      <h3 className="text-base font-semibold text-gray-800 mb-3">
        Баланс (приход − выдача)
      </h3>
      <div className="flex items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">От</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">До</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={fetchBalance}
          disabled={loading}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? '...' : 'Показать'}
        </button>
      </div>

      {fetched && (
        data.length === 0 ? (
          <p className="text-sm text-gray-400">Нет данных за выбранный период</p>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Наименование</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Артикул</th>
                  <th className="text-right px-3 py-2 font-semibold text-green-700">Приход</th>
                  <th className="text-right px-3 py-2 font-semibold text-red-700">Выдача</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-800">Разница</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((b) => (
                  <tr key={b.productId} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5">{b.name}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{b.article || ''}</td>
                    <td className="px-3 py-1.5 text-right text-green-700">+{b.incoming}</td>
                    <td className="px-3 py-1.5 text-right text-red-700">−{b.outgoing}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${b.difference >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {b.difference >= 0 ? '+' : ''}{b.difference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
