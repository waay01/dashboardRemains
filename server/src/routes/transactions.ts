import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { type, date, from, to, page = '1', limit = '30' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, parseInt(limit as string));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (type === 'incoming' || type === 'outgoing') {
      where.type = type;
    }
    if (date) {
      const d = new Date(date as string);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    } else if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) {
        const toDate = new Date(to as string);
        toDate.setDate(toDate.getDate() + 1);
        where.date.lt = toDate;
      }
    }

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { name: true, article: true } },
              cell: { select: { address: true } },
            },
          },
          user: { select: { username: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        documentNumber: t.documentNumber,
        driverName: t.driverName,
        counterparty: t.counterparty,
        date: t.date,
        createdAt: t.createdAt,
        username: t.user?.username,
        itemCount: t.items.length,
        totalQuantity: t.items.reduce((sum, i) => sum + i.quantity, 0),
        items: t.items.map((i) => ({
          id: i.id,
          cellAddress: i.cellAddress,
          productName: i.product.name,
          article: i.product.article,
          quantity: i.quantity,
          productId: i.productId,
        })),
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки транзакций' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, documentNumber, driverName, counterparty, date, items } = req.body;

    if (!type || !documentNumber || !date || !items?.length) {
      res.status(400).json({ error: 'Тип, номер документа, дата и позиции обязательны' });
      return;
    }

    if (type !== 'incoming' && type !== 'outgoing') {
      res.status(400).json({ error: 'Тип должен быть incoming или outgoing' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          type,
          documentNumber,
          driverName: driverName || null,
          counterparty: counterparty || null,
          date: new Date(date),
          userId: req.userId || null,
          items: {
            create: items.map((item: any) => ({
              cellAddress: item.cellAddress,
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of items) {
        const delta = type === 'incoming' ? item.quantity : -item.quantity;
        await tx.stock.upsert({
          where: {
            cellAddress_productId: {
              cellAddress: item.cellAddress,
              productId: item.productId,
            },
          },
          create: {
            cellAddress: item.cellAddress,
            productId: item.productId,
            quantity: Math.max(0, delta),
          },
          update: {
            quantity: { increment: delta },
          },
        });
      }

      return transaction;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания транзакции' });
  }
});

router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) {
      const toDate = new Date(to as string);
      toDate.setDate(toDate.getDate() + 1);
      dateFilter.lt = toDate;
    }

    const where: any = {};
    if (Object.keys(dateFilter).length) where.date = dateFilter;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, article: true } },
          },
        },
      },
    });

    const balanceMap = new Map<
      number,
      { productId: number; name: string; article: string | null; incoming: number; outgoing: number }
    >();

    for (const t of transactions) {
      for (const item of t.items) {
        const existing = balanceMap.get(item.productId) || {
          productId: item.productId,
          name: item.product.name,
          article: item.product.article,
          incoming: 0,
          outgoing: 0,
        };
        if (t.type === 'incoming') {
          existing.incoming += item.quantity;
        } else {
          existing.outgoing += item.quantity;
        }
        balanceMap.set(item.productId, existing);
      }
    }

    const balance = Array.from(balanceMap.values()).map((b) => ({
      ...b,
      difference: b.incoming - b.outgoing,
    }));

    balance.sort((a, b) => a.name.localeCompare(b.name));

    res.json(balance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка расчёта баланса' });
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { name: true, article: true } },
            cell: { select: { address: true, sector: true } },
          },
        },
        user: { select: { username: true } },
      },
    });

    if (!transaction) {
      res.status(404).json({ error: 'Транзакция не найдена' });
      return;
    }

    res.json(transaction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки транзакции' });
  }
});

export default router;
