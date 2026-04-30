export interface StockItem {
  id: number;
  cellAddress: string;
  sector: string | null;
  productName: string;
  article: string | null;
  externalCode: string | null;
  quantity: number;
  productId: number;
}

export interface StockResponse {
  items: StockItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Product {
  id: number;
  name: string;
  article: string | null;
  externalCode: string | null;
}

export interface TransactionItem {
  id?: number;
  cellAddress: string;
  productName?: string;
  article?: string | null;
  quantity: number;
  productId: number;
}

export interface Transaction {
  id: number;
  type: 'incoming' | 'outgoing';
  documentNumber: string;
  driverName: string | null;
  counterparty: string | null;
  date: string;
  createdAt: string;
  username?: string;
  itemCount: number;
  totalQuantity: number;
  items: TransactionItem[];
}

export interface TransactionsResponse {
  items: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

export interface BalanceItem {
  productId: number;
  name: string;
  article: string | null;
  incoming: number;
  outgoing: number;
  difference: number;
}

export interface CreateTransactionPayload {
  type: 'incoming' | 'outgoing';
  documentNumber: string;
  driverName: string;
  counterparty: string;
  date: string;
  items: { cellAddress: string; productId: number; quantity: number }[];
}

export interface User {
  id: number;
  username: string;
}

export interface Cell {
  address: string;
  sector: string | null;
}
