import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EXCEL_PATH = path.resolve(__dirname, '../../ST Остатки 21.03.xlsx');
const BATCH_SIZE = 1000;

async function main() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_PATH);

  // --- Import products from "Материалы" sheet ---
  console.log('Importing products from "Материалы"...');
  const matSheet = workbook.Sheets['Материалы'];
  const matRows: any[] = XLSX.utils.sheet_to_json(matSheet);
  console.log(`  Found ${matRows.length} product rows`);

  const articleToProductId = new Map<string, number>();

  for (let i = 0; i < matRows.length; i += BATCH_SIZE) {
    const batch = matRows.slice(i, i + BATCH_SIZE);
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
    if ((i / BATCH_SIZE) % 20 === 0) {
      console.log(`  Products: ${Math.min(i + BATCH_SIZE, matRows.length)}/${matRows.length}`);
    }
  }
  console.log(`  Products imported: ${articleToProductId.size} with articles`);

  // --- Import cells and stock from "ОБЩЕЕ 21.03" sheet ---
  console.log('Importing cells and stock from "ОБЩЕЕ 21.03"...');
  const stockSheet = workbook.Sheets['ОБЩЕЕ 21.03'];
  const stockRows: any[] = XLSX.utils.sheet_to_json(stockSheet);
  console.log(`  Found ${stockRows.length} stock rows`);

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

  console.log(`  Creating ${cellsToCreate.length} cells...`);
  for (let i = 0; i < cellsToCreate.length; i += BATCH_SIZE) {
    const batch = cellsToCreate.slice(i, i + BATCH_SIZE);
    await prisma.cell.createMany({ data: batch, skipDuplicates: true });
    if ((i / BATCH_SIZE) % 10 === 0) {
      console.log(`  Cells: ${Math.min(i + BATCH_SIZE, cellsToCreate.length)}/${cellsToCreate.length}`);
    }
  }

  console.log(`  Creating ${stockToCreate.length} stock entries...`);
  for (let i = 0; i < stockToCreate.length; i += BATCH_SIZE) {
    const batch = stockToCreate.slice(i, i + BATCH_SIZE);
    await prisma.stock.createMany({ data: batch, skipDuplicates: true });
    if ((i / BATCH_SIZE) % 10 === 0) {
      console.log(`  Stock: ${Math.min(i + BATCH_SIZE, stockToCreate.length)}/${stockToCreate.length}`);
    }
  }

  // --- Create default admin user ---
  const passwordHash = await bcrypt.hash('admin', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash },
  });
  console.log('Default user created: admin / admin');

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
