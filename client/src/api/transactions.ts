import api from './client';
import { TransactionsResponse, BalanceItem, CreateTransactionPayload, Product } from '../types';

export async function getTransactions(params: {
  type?: string;
  date?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get<TransactionsResponse>('/transactions', { params });
  return data;
}

export async function createTransaction(payload: CreateTransactionPayload) {
  const { data } = await api.post('/transactions', payload);
  return data;
}

export async function getBalance(params: { from?: string; to?: string }) {
  const { data } = await api.get<BalanceItem[]>('/transactions/balance', { params });
  return data;
}

export async function searchProducts(search: string) {
  const { data } = await api.get<Product[]>('/products', { params: { search, limit: 20 } });
  return data;
}
