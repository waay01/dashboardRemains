import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  CellContext,
} from '@tanstack/react-table';
import { StockItem } from '../types';
import { getStock, updateStock, exportStockExcel, deleteAllStock, uploadStockExcel } from '../api/stock';

const col = createColumnHelper<StockItem>();

type FieldKey = 'cellAddress' | 'productName' | 'quantity' | 'sector' | 'article' | 'externalCode';

function EditableCell({
  getValue,
  row,
  column,
  table,
}: CellContext<StockItem, any>) {
  const initialValue = getValue() ?? '';
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const field = column.id as FieldKey;
  const isNumber = field === 'quantity';

  useEffect(() => {
    setValue(initialValue ?? '');
  }, [initialValue]);

  const save = async () => {
    setEditing(false);
    const newVal = isNumber ? Number(value) : String(value).trim();
    if (newVal !== initialValue) {
      try {
        const updated = await updateStock(row.original.id, { [field]: newVal });
        (table.options.meta as any)?.onRowUpdated(row.original.id, updated);
      } catch {
        setValue(initialValue);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') {
      setValue(initialValue);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={isNumber ? 'number' : 'text'}
        value={value}
        onChange={(e) => setValue(isNumber ? Number(e.target.value) : e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoFocus
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer px-1 py-0.5 rounded hover:bg-blue-50 block truncate min-h-[1.5rem]"
      title={String(value || '—')}
    >
      {value || <span className="text-gray-300">—</span>}
    </span>
  );
}

const columns = [
  col.accessor('cellAddress', {
    header: 'Адрес',
    size: 130,
    cell: EditableCell,
  }),
  col.accessor('productName', {
    header: 'Наименование',
    size: 400,
    cell: EditableCell,
  }),
  col.accessor('quantity', {
    header: 'Кол-во',
    size: 80,
    cell: EditableCell,
  }),
  col.accessor('sector', {
    header: 'Сектор',
    size: 80,
    cell: EditableCell,
  }),
  col.accessor('article', {
    header: 'Артикул',
    size: 140,
    cell: EditableCell,
  }),
  col.accessor('externalCode', {
    header: 'Экстернал',
    size: 280,
    cell: EditableCell,
  }),
];

export default function StockPage() {
  const [data, setData] = useState<StockItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const limit = 50;

  const fetchData = useCallback(async (s: string, p: number) => {
    setLoading(true);
    try {
      const res = await getStock({ search: s || undefined, page: p, limit });
      setData(res.items);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(search, page);
  }, [page, fetchData]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchData(val, 1);
    }, 350);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportStockExcel();
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAllStock();
      setShowDeleteConfirm(false);
      setData([]);
      setTotal(0);
      setTotalPages(1);
      setPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await uploadStockExcel(file);
      setUploadResult(`Загружено: ${result.products} товаров, ${result.cells} ячеек, ${result.stock} остатков`);
      setPage(1);
      fetchData(search, 1);
    } catch (err: any) {
      setUploadResult(err.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      onRowUpdated: (id: number, updated: StockItem) => {
        setData((prev) => prev.map((row) => (row.id === id ? updated : row)));
      },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <input
            type="text"
            placeholder="Поиск по наименованию, артикулу или адресу ячейки..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 max-w-lg px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <span className="text-sm text-gray-500 whitespace-nowrap">Найдено: {total.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? 'Загрузка...' : 'Загрузить Excel'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? 'Экспорт...' : 'Экспорт в Excel'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Удалить все
          </button>
        </div>
      </div>

      {uploadResult && (
        <div className="mb-3 px-4 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm flex items-center justify-between">
          <span>{uploadResult}</span>
          <button onClick={() => setUploadResult(null)} className="text-blue-400 hover:text-blue-600 ml-4">&times;</button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Удалить все данные?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Будут удалены все остатки, ячейки, товары и история транзакций. Это действие необратимо.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deleting ? 'Удаление...' : 'Да, удалить'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-gray-50 border-b border-gray-200">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-gray-400">
                    Загрузка...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-gray-400">
                    Нет данных
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-1.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Стр. {page} из {totalPages}
          </span>
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
    </div>
  );
}
