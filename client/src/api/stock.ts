import api from './client';
import { StockResponse, StockItem } from '../types';

export async function getStock(params: { search?: string; page?: number; limit?: number }) {
  const { data } = await api.get<StockResponse>('/stock', { params });
  return data;
}

export async function updateStock(id: number, fields: Partial<Omit<StockItem, 'id' | 'productId'>>) {
  const { data } = await api.put(`/stock/${id}`, fields);
  return data as StockItem;
}

export async function deleteAllStock() {
  const { data } = await api.delete('/stock/all');
  return data;
}

export async function uploadStockExcel(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/stock/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
  return data as { message: string; products: number; cells: number; stock: number };
}

export async function exportStockExcel() {
  const response = await api.get('/stock/export', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `Остатки_${date}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
