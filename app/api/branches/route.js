import { NextResponse } from 'next/server';
import { BRANCHES, FACTORY, DRIVER, DRIVERS, DIRECTOR, DIRECTORS } from '@/lib/branches';

export async function POST() {
  return NextResponse.json({
    branches: BRANCHES.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      manager_username: b.manager_username,
      manager_phone: b.manager_phone || null,
    })),
    factory: {
      id: FACTORY.id,
      name: FACTORY.name,
      address: FACTORY.address,
      lat: FACTORY.lat,
      lng: FACTORY.lng,
      manager_username: FACTORY.manager_username,
      manager_phone: FACTORY.manager_phone || null,
    },
    driver: DRIVER,
    drivers: DRIVERS.map((d) => ({
      name: d.name,
      phone: d.phone || null,
      username: d.username || null,
    })),
    director: {
      username: DIRECTOR.username,
      phone: DIRECTOR.phone || null,
    },
    directors: DIRECTORS.map((d) => ({
      username: d.username,
      phone: d.phone || null,
      label: d.label || 'Директор',
    })),
  });
}

export async function GET() {
  return POST();
}
