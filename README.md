# Склад — Дашборд остатков

Управление складскими остатками, приходом и выдачей товара.

## Стек

- **Frontend**: React 18 + TypeScript, Vite, TanStack Table, Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **БД**: PostgreSQL + Prisma ORM

## Запуск

### 1. База данных

Нужен PostgreSQL. Настройте подключение в `server/.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dashboard_remains"
```

Создайте базу:
```bash
createdb dashboard_remains
```

### 2. Сервер

```bash
cd server
npm install
npx prisma migrate dev --name init
npm run seed    # импорт данных из Excel (~5-10 мин)
npm run dev     # запуск на http://localhost:3001
```

### 3. Клиент

```bash
cd client
npm install
npm run dev     # запуск на http://localhost:5173
```

### Вход

По умолчанию: `admin` / `admin`

## Функции

- **Остатки** — таблица с поиском, inline-редактированием, экспортом в Excel
- **Приход** — документы поступления товара с водителем, контрагентом
- **Выдача** — документы выдачи товара
- **Баланс** — разница приход − выдача за период
