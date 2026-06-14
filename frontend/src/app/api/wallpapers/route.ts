import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const wallpapersDir = path.join(process.cwd(), 'public', 'wallpapers');
  try {
    if (!fs.existsSync(wallpapersDir)) {
      return NextResponse.json({ wallpapers: [] });
    }
    const files = fs.readdirSync(wallpapersDir);
    const wallpapers = files.filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f)).map(f => ({
      id: f,
      name: f.replace(/\.[^/.]+$/, "").split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      url: `/wallpapers/${f}`
    }));
    return NextResponse.json({ wallpapers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read wallpapers' }, { status: 500 });
  }
}
