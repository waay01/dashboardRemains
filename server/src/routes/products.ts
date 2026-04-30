import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { search, limit = '20' } = req.query;
    const limitNum = Math.min(100, parseInt(limit as string));

    const where: any = {};
    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { article: { contains: s, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      take: limitNum,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, article: true, externalCode: true },
    });

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки товаров' });
  }
});

export default router;
