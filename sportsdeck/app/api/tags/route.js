import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';

// GET /api/tags?page=1&pageSize=50&q=prefix&includeTotal=true
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
    const q = (searchParams.get('q') || '').trim();
    const includeTotal = searchParams.get('includeTotal') === 'true';

    const where = q ? { name: { contains: q, mode: 'insensitive' } } : {};

    const skip = (page - 1) * pageSize;

    if (includeTotal) {
      const [total, items] = await prisma.$transaction([
        prisma.tag.count({ where }),
        prisma.tag.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize }),
      ]);

      return NextResponse.json({ items, total, page, pageSize }, { status: 200 });
    }

    const items = await prisma.tag.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize });
    return NextResponse.json({ items, page, pageSize }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}
