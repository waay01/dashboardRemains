import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      where.OR = [
        { cellAddress: { contains: s, mode: 'insensitive' } },
        { product: { name: { contains: s, mode: 'insensitive' } } },
        { product: { article: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, article: true, externalCode: true } },
          cell: { select: { address: true, sector: true } },
        },
        orderBy: { cellAddress: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.stock.count({ where }),
    ]);

    res.json({
      items: items.map((s) => ({
        id: s.id,
        cellAddress: s.cellAddress,
        sector: s.cell.sector,
        productName: s.product.name,
        article: s.product.article,
        externalCode: s.product.externalCode,
        quantity: s.quantity,
        productId: s.productId,
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки остатков' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { cellAddress, productName, quantity, sector, article, externalCode } = req.body;

    const stock = await prisma.stock.findUnique({
      where: { id },
      include: { product: true, cell: true },
    });
    if (!stock) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      if (sector !== undefined && sector !== stock.cell.sector) {
        await tx.cell.update({
          where: { address: stock.cellAddress },
          data: { sector: sector || null },
        });
      }

      const productUpdates: any = {};
      if (productName !== undefined && productName !== stock.product.name) {
        productUpdates.name = productName;
      }
      if (article !== undefined && article !== stock.product.article) {
        productUpdates.article = article || null;
      }
      if (externalCode !== undefined && externalCode !== stock.product.externalCode) {
        productUpdates.externalCode = externalCode || null;
      }
      if (Object.keys(productUpdates).length > 0) {
        await tx.product.update({
          where: { id: stock.productId },
          data: productUpdates,
        });
      }

      const stockUpdates: any = {};
      if (typeof quantity === 'number') {
        stockUpdates.quantity = quantity;
      }
      if (cellAddress && cellAddress !== stock.cellAddress) {
        await tx.cell.upsert({
          where: { address: cellAddress },
          create: { address: cellAddress, sector: sector ?? stock.cell.sector },
          update: {},
        });
        stockUpdates.cellAddress = cellAddress;
      }
      if (Object.keys(stockUpdates).length > 0) {
        await tx.stock.update({ where: { id }, data: stockUpdates });
      }
    });

    const updated = await prisma.stock.findUnique({
      where: { id },
      include: {
        product: { select: { name: true, article: true, externalCode: true } },
        cell: { select: { sector: true } },
      },
    });

    res.json({
      id: updated!.id,
      cellAddress: updated!.cellAddress,
      sector: updated!.cell.sector,
      productName: updated!.product.name,
      article: updated!.product.article,
      externalCode: updated!.product.externalCode,
      quantity: updated!.quantity,
      productId: updated!.productId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

router.delete('/all', authMiddleware, async (_req: Request, res: Response) => {
  try {
    await prisma.$transaction([
      prisma.transactionItem.deleteMany(),
      prisma.transaction.deleteMany(),
      prisma.stock.deleteMany(),
      prisma.cell.deleteMany(),
      prisma.product.deleteMany(),
    ]);
    res.json({ message: 'Все остатки удалены' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

router.post('/upload', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });

    const matSheetName = workbook.SheetNames.find((n) => n.toLowerCase().includes('материал'));
    const stockSheetName = workbook.SheetNames.find(
      (n) => n.toLowerCase().includes('общее') && !n.toLowerCase().includes('материал')
    );

    if (!stockSheetName) {
      res.status(400).json({ error: 'Лист "ОБЩЕЕ" не найден в файле' });
      return;
    }

    await prisma.$transaction([
      prisma.transactionItem.deleteMany(),
      prisma.transaction.deleteMany(),
      prisma.stock.deleteMany(),
      prisma.cell.deleteMany(),
      prisma.product.deleteMany(),
    ]);

    const BATCH = 1000;
    const articleToProductId = new Map<string, number>();

    if (matSheetName) {
      const matSheet = workbook.Sheets[matSheetName];
      const matRows: any[] = XLSX.utils.sheet_to_json(matSheet);

      for (let i = 0; i < matRows.length; i += BATCH) {
        const batch = matRows.slice(i, i + BATCH);
        const created = await prisma.$transaction(
          batch.map((row) =>
            prisma.product.create({
              data: {
                tid: row.tid ? Number(row.tid) : null,
                name: String(row.name || '').trim(),
                article: row.article ? String(row.article).trim() : null,
                externalCode: row.externalcode ? String(row.externalcode).trim() : null,
              },
            })
          )
        );
        for (const p of created) {
          if (p.article) articleToProductId.set(p.article, p.id);
        }
      }
    }

    const stockSheet = workbook.Sheets[stockSheetName];
    const stockRows: any[] = XLSX.utils.sheet_to_json(stockSheet);

    const cellsToCreate: { address: string; sector: string | null }[] = [];
    const stockToCreate: { cellAddress: string; productId: number; quantity: number }[] = [];
    const seenCells = new Set<string>();

    for (const row of stockRows) {
      const address = row['Адрес'] ? String(row['Адрес']).trim() : null;
      if (!address) continue;

      if (!seenCells.has(address)) {
        seenCells.add(address);
        cellsToCreate.push({
          address,
          sector: row['Сектор'] ? String(row['Сектор']).trim() : null,
        });
      }

      const article = row['Артикул'] ? String(row['Артикул']).trim() : null;
      const qty = row['Кол-во'] !== undefined ? Number(row['Кол-во']) : 0;
      const name = row['Наименование'] ? String(row['Наименование']).trim() : null;

      if (article && name && articleToProductId.has(article)) {
        stockToCreate.push({
          cellAddress: address,
          productId: articleToProductId.get(article)!,
          quantity: isNaN(qty) ? 0 : qty,
        });
      }
    }

    for (let i = 0; i < cellsToCreate.length; i += BATCH) {
      await prisma.cell.createMany({ data: cellsToCreate.slice(i, i + BATCH), skipDuplicates: true });
    }

    for (let i = 0; i < stockToCreate.length; i += BATCH) {
      await prisma.stock.createMany({ data: stockToCreate.slice(i, i + BATCH), skipDuplicates: true });
    }

    res.json({
      message: 'Данные загружены',
      products: articleToProductId.size,
      cells: cellsToCreate.length,
      stock: stockToCreate.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

router.get('/export', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const allStock = await prisma.stock.findMany({
      include: {
        product: { select: { name: true, article: true, externalCode: true } },
        cell: { select: { address: true, sector: true } },
      },
      orderBy: { cellAddress: 'asc' },
    });

    const allCells = await prisma.cell.findMany({ orderBy: { address: 'asc' } });

    const cellStockMap = new Map<string, typeof allStock>();
    for (const s of allStock) {
      const list = cellStockMap.get(s.cellAddress) || [];
      list.push(s);
      cellStockMap.set(s.cellAddress, list);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('ОБЩЕЕ');

    sheet.columns = [
      { header: 'Адрес', key: 'address', width: 16 },
      { header: 'Наименование', key: 'name', width: 55 },
      { header: 'Кол-во', key: 'quantity', width: 10 },
      { header: 'Сектор', key: 'sector', width: 10 },
      { header: 'Артикул', key: 'article', width: 18 },
      { header: 'Экстернал', key: 'external', width: 40 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    for (const cell of allCells) {
      const stockItems = cellStockMap.get(cell.address);
      if (stockItems && stockItems.length > 0) {
        for (const s of stockItems) {
          sheet.addRow({
            address: cell.address,
            name: s.product.name,
            quantity: s.quantity,
            sector: cell.sector || '',
            article: s.product.article || '',
            external: s.product.externalCode || '',
          });
        }
      } else {
        sheet.addRow({
          address: cell.address,
          name: '',
          quantity: '',
          sector: cell.sector || '',
          article: '',
          external: '',
        });
      }
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=stock_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

export default router;
