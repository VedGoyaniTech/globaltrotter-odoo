import { ActivityCategory, ExpenseCategory, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const cities = [
  { name: 'Paris', country: 'France', region: 'Europe', costIndex: 128, popularity: 98, latitude: 48.8566, longitude: 2.3522 },
  { name: 'Rome', country: 'Italy', region: 'Europe', costIndex: 112, popularity: 94, latitude: 41.9028, longitude: 12.4964 },
  { name: 'Barcelona', country: 'Spain', region: 'Europe', costIndex: 104, popularity: 92, latitude: 41.3874, longitude: 2.1686 },
  { name: 'Amsterdam', country: 'Netherlands', region: 'Europe', costIndex: 121, popularity: 88, latitude: 52.3676, longitude: 4.9041 },
  { name: 'Prague', country: 'Czechia', region: 'Europe', costIndex: 78, popularity: 82, latitude: 50.0755, longitude: 14.4378 },
  { name: 'Tokyo', country: 'Japan', region: 'Asia', costIndex: 118, popularity: 97, latitude: 35.6762, longitude: 139.6503 },
  { name: 'Kyoto', country: 'Japan', region: 'Asia', costIndex: 106, popularity: 89, latitude: 35.0116, longitude: 135.7681 },
  { name: 'Bangkok', country: 'Thailand', region: 'Asia', costIndex: 58, popularity: 91, latitude: 13.7563, longitude: 100.5018 },
  { name: 'Bali', country: 'Indonesia', region: 'Asia', costIndex: 52, popularity: 90, latitude: -8.4095, longitude: 115.1889 },
  { name: 'Singapore', country: 'Singapore', region: 'Asia', costIndex: 132, popularity: 86, latitude: 1.3521, longitude: 103.8198 },
  { name: 'Jaipur', country: 'India', region: 'Asia', costIndex: 38, popularity: 80, latitude: 26.9124, longitude: 75.7873 },
  { name: 'Goa', country: 'India', region: 'Asia', costIndex: 42, popularity: 85, latitude: 15.2993, longitude: 74.124 },
  { name: 'Udaipur', country: 'India', region: 'Asia', costIndex: 36, popularity: 74, latitude: 24.5854, longitude: 73.7125 },
  { name: 'Dubai', country: 'UAE', region: 'Middle East', costIndex: 125, popularity: 87, latitude: 25.2048, longitude: 55.2708 },
  { name: 'New York', country: 'USA', region: 'North America', costIndex: 145, popularity: 96, latitude: 40.7128, longitude: -74.006 },
  { name: 'Reykjavik', country: 'Iceland', region: 'Europe', costIndex: 138, popularity: 71, latitude: 64.1466, longitude: -21.9426 },
];

// [cityName, activity name, category, cost, minutes]
const activities: [string, string, ActivityCategory, number, number][] = [
  ['Paris', 'Louvre Museum entry', ActivityCategory.CULTURE, 22, 180],
  ['Paris', 'Eiffel Tower summit', ActivityCategory.SIGHTSEEING, 29, 120],
  ['Paris', 'Seine dinner cruise', ActivityCategory.FOOD, 85, 150],
  ['Rome', 'Colosseum guided tour', ActivityCategory.CULTURE, 35, 150],
  ['Rome', 'Vatican Museums', ActivityCategory.CULTURE, 27, 210],
  ['Rome', 'Trastevere food walk', ActivityCategory.FOOD, 60, 180],
  ['Barcelona', 'Sagrada Familia', ActivityCategory.SIGHTSEEING, 26, 90],
  ['Barcelona', 'Tapas crawl in Gothic Quarter', ActivityCategory.FOOD, 55, 180],
  ['Amsterdam', 'Canal cruise', ActivityCategory.SIGHTSEEING, 18, 75],
  ['Amsterdam', 'Van Gogh Museum', ActivityCategory.CULTURE, 22, 120],
  ['Prague', 'Old Town free walking tour', ActivityCategory.SIGHTSEEING, 0, 150],
  ['Prague', 'Prague Castle', ActivityCategory.CULTURE, 17, 180],
  ['Tokyo', 'TeamLab Planets', ActivityCategory.CULTURE, 28, 120],
  ['Tokyo', 'Tsukiji outer market breakfast', ActivityCategory.FOOD, 25, 90],
  ['Tokyo', 'Shibuya night walk', ActivityCategory.NIGHTLIFE, 0, 120],
  ['Kyoto', 'Fushimi Inari hike', ActivityCategory.NATURE, 0, 180],
  ['Kyoto', 'Tea ceremony', ActivityCategory.CULTURE, 45, 90],
  ['Bangkok', 'Grand Palace', ActivityCategory.SIGHTSEEING, 15, 150],
  ['Bangkok', 'Street food tour', ActivityCategory.FOOD, 30, 180],
  ['Bali', 'Ubud rice terrace trek', ActivityCategory.NATURE, 20, 240],
  ['Bali', 'Surf lesson in Canggu', ActivityCategory.ADVENTURE, 35, 120],
  ['Singapore', 'Gardens by the Bay', ActivityCategory.NATURE, 20, 150],
  ['Jaipur', 'Amber Fort', ActivityCategory.CULTURE, 8, 180],
  ['Jaipur', 'Bazaar shopping walk', ActivityCategory.SHOPPING, 5, 120],
  ['Goa', 'Beach day at Palolem', ActivityCategory.RELAXATION, 0, 300],
  ['Goa', 'Scuba diving at Grande Island', ActivityCategory.ADVENTURE, 45, 240],
  ['Udaipur', 'Lake Pichola boat ride', ActivityCategory.SIGHTSEEING, 12, 60],
  ['Dubai', 'Desert safari', ActivityCategory.ADVENTURE, 70, 360],
  ['Dubai', 'Burj Khalifa observation deck', ActivityCategory.SIGHTSEEING, 45, 90],
  ['New York', 'Broadway show', ActivityCategory.CULTURE, 120, 180],
  ['New York', 'Central Park bike ride', ActivityCategory.NATURE, 25, 120],
  ['Reykjavik', 'Blue Lagoon', ActivityCategory.RELAXATION, 80, 240],
  ['Reykjavik', 'Northern lights tour', ActivityCategory.NATURE, 95, 300],
];

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

async function main() {
  console.log('Seeding GlobeTrotter...');

  for (const city of cities) {
    await prisma.city.upsert({
      where: { name_country: { name: city.name, country: city.country } },
      create: city,
      update: city,
    });
  }

  const cityByName = new Map(
    (await prisma.city.findMany()).map((c) => [c.name, c] as const),
  );

  for (const [cityName, name, category, cost, durationMinutes] of activities) {
    const city = cityByName.get(cityName);
    if (!city) continue;
    const existing = await prisma.activity.findFirst({ where: { cityId: city.id, name } });
    if (existing) continue;
    await prisma.activity.create({
      data: { cityId: city.id, name, category, cost, durationMinutes },
    });
  }

  const passwordHash = await bcrypt.hash('Password123', 10);

  const demo = await prisma.user.upsert({
    where: { email: 'demo@globetrotter.app' },
    create: {
      name: 'Demo Traveller',
      email: 'demo@globetrotter.app',
      passwordHash,
      city: 'Surat',
      country: 'India',
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: 'admin@globetrotter.app' },
    create: {
      name: 'Admin',
      email: 'admin@globetrotter.app',
      passwordHash,
      role: Role.ADMIN,
    },
    update: { role: Role.ADMIN },
  });

  // One fully-populated trip so every screen has data on first load.
  const existingTrip = await prisma.trip.findFirst({
    where: { userId: demo.id, name: 'European Summer Loop' },
  });

  if (!existingTrip) {
    const paris = cityByName.get('Paris')!;
    const rome = cityByName.get('Rome')!;
    const barcelona = cityByName.get('Barcelona')!;

    const parisActivities = await prisma.activity.findMany({ where: { cityId: paris.id }, take: 2 });
    const romeActivities = await prisma.activity.findMany({ where: { cityId: rome.id }, take: 2 });

    await prisma.trip.create({
      data: {
        userId: demo.id,
        name: 'European Summer Loop',
        description: 'Three cities, ten days, mostly trains and pastries.',
        startDate: day(21),
        endDate: day(30),
        budgetLimit: 2500,
        isPublic: true,
        publicSlug: 'demo-euro-loop',
        stops: {
          create: [
            {
              cityId: paris.id,
              startDate: day(21),
              endDate: day(24),
              orderIndex: 0,
              activities: {
                create: parisActivities.map((a, i) => ({
                  activityId: a.id,
                  name: a.name,
                  cost: a.cost,
                  durationMinutes: a.durationMinutes,
                  scheduledDate: day(22 + i),
                  startTime: i === 0 ? '10:00' : '15:00',
                  orderIndex: i,
                })),
              },
            },
            {
              cityId: rome.id,
              startDate: day(24),
              endDate: day(27),
              orderIndex: 1,
              activities: {
                create: romeActivities.map((a, i) => ({
                  activityId: a.id,
                  name: a.name,
                  cost: a.cost,
                  durationMinutes: a.durationMinutes,
                  scheduledDate: day(25 + i),
                  startTime: '09:30',
                  orderIndex: i,
                })),
              },
            },
            { cityId: barcelona.id, startDate: day(27), endDate: day(30), orderIndex: 2 },
          ],
        },
        expenses: {
          create: [
            { category: ExpenseCategory.TRANSPORT, label: 'Flights', amount: 620 },
            { category: ExpenseCategory.TRANSPORT, label: 'Rail passes', amount: 180 },
            { category: ExpenseCategory.STAY, label: 'Hotels (9 nights)', amount: 990 },
            { category: ExpenseCategory.MEALS, label: 'Food budget', amount: 450 },
          ],
        },
      },
    });
  }

  console.log('Seed complete.');
  console.log('  demo@globetrotter.app  / Password123');
  console.log('  admin@globetrotter.app / Password123  (ADMIN)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
