import { ActivityCategory, ExpenseCategory, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const cities = [
  {
    name: 'Paris',
    country: 'France',
    region: 'Europe',
    costIndex: 128,
    popularity: 98,
    latitude: 48.8566,
    longitude: 2.3522,
  },
  {
    name: 'Rome',
    country: 'Italy',
    region: 'Europe',
    costIndex: 112,
    popularity: 94,
    latitude: 41.9028,
    longitude: 12.4964,
  },
  {
    name: 'Barcelona',
    country: 'Spain',
    region: 'Europe',
    costIndex: 104,
    popularity: 92,
    latitude: 41.3874,
    longitude: 2.1686,
  },
  {
    name: 'Amsterdam',
    country: 'Netherlands',
    region: 'Europe',
    costIndex: 121,
    popularity: 88,
    latitude: 52.3676,
    longitude: 4.9041,
  },
  {
    name: 'Prague',
    country: 'Czechia',
    region: 'Europe',
    costIndex: 78,
    popularity: 82,
    latitude: 50.0755,
    longitude: 14.4378,
  },
  {
    name: 'Tokyo',
    country: 'Japan',
    region: 'Asia',
    costIndex: 118,
    popularity: 97,
    latitude: 35.6762,
    longitude: 139.6503,
  },
  {
    name: 'Kyoto',
    country: 'Japan',
    region: 'Asia',
    costIndex: 106,
    popularity: 89,
    latitude: 35.0116,
    longitude: 135.7681,
  },
  {
    name: 'Bangkok',
    country: 'Thailand',
    region: 'Asia',
    costIndex: 58,
    popularity: 91,
    latitude: 13.7563,
    longitude: 100.5018,
  },
  {
    name: 'Bali',
    country: 'Indonesia',
    region: 'Asia',
    costIndex: 52,
    popularity: 90,
    latitude: -8.4095,
    longitude: 115.1889,
  },
  {
    name: 'Singapore',
    country: 'Singapore',
    region: 'Asia',
    costIndex: 132,
    popularity: 86,
    latitude: 1.3521,
    longitude: 103.8198,
  },
  {
    name: 'Jaipur',
    country: 'India',
    region: 'Asia',
    costIndex: 38,
    popularity: 80,
    latitude: 26.9124,
    longitude: 75.7873,
  },
  {
    name: 'Goa',
    country: 'India',
    region: 'Asia',
    costIndex: 42,
    popularity: 85,
    latitude: 15.2993,
    longitude: 74.124,
  },
  {
    name: 'Udaipur',
    country: 'India',
    region: 'Asia',
    costIndex: 36,
    popularity: 74,
    latitude: 24.5854,
    longitude: 73.7125,
  },
  {
    name: 'Dubai',
    country: 'UAE',
    region: 'Middle East',
    costIndex: 125,
    popularity: 87,
    latitude: 25.2048,
    longitude: 55.2708,
  },
  {
    name: 'New York',
    country: 'USA',
    region: 'North America',
    costIndex: 145,
    popularity: 96,
    latitude: 40.7128,
    longitude: -74.006,
  },
  {
    name: 'Reykjavik',
    country: 'Iceland',
    region: 'Europe',
    costIndex: 138,
    popularity: 71,
    latitude: 64.1466,
    longitude: -21.9426,
  },
];

// [cityName, activity name, category, cost, minutes, description]
const activities: [string, string, ActivityCategory, number, number, string][] = [
  [
    'Paris',
    'Louvre Museum entry',
    ActivityCategory.CULTURE,
    22,
    180,
    'Book the timed entry and start in the Denon wing before the crowds arrive.',
  ],
  [
    'Paris',
    'Eiffel Tower summit',
    ActivityCategory.SIGHTSEEING,
    29,
    120,
    'Lift to the very top; the second floor has the better views of the city grid.',
  ],
  [
    'Paris',
    'Seine dinner cruise',
    ActivityCategory.FOOD,
    85,
    150,
    'Two hours on the water with dinner as the bridges light up.',
  ],
  [
    'Rome',
    'Colosseum guided tour',
    ActivityCategory.CULTURE,
    35,
    150,
    'Skip-the-line access with the arena floor and underground included.',
  ],
  [
    'Rome',
    'Vatican Museums',
    ActivityCategory.CULTURE,
    27,
    210,
    'Galleries, tapestries and the Sistine Chapel at the end. Go early.',
  ],
  [
    'Rome',
    'Trastevere food walk',
    ActivityCategory.FOOD,
    60,
    180,
    'Six tastings through the old quarter, ending with tiramisu.',
  ],
  [
    'Barcelona',
    'Sagrada Familia',
    ActivityCategory.SIGHTSEEING,
    26,
    90,
    'Timed entry to Gaudi unfinished basilica; the light is best late afternoon.',
  ],
  [
    'Barcelona',
    'Tapas crawl in Gothic Quarter',
    ActivityCategory.FOOD,
    55,
    180,
    'Four bars, one neighbourhood, vermouth included.',
  ],
  [
    'Amsterdam',
    'Canal cruise',
    ActivityCategory.SIGHTSEEING,
    18,
    75,
    'Open-boat loop through the ring canals with a local skipper.',
  ],
  [
    'Amsterdam',
    'Van Gogh Museum',
    ActivityCategory.CULTURE,
    22,
    120,
    'The largest collection of his work, arranged chronologically.',
  ],
  [
    'Prague',
    'Old Town free walking tour',
    ActivityCategory.SIGHTSEEING,
    0,
    150,
    'Tip-based two-hour introduction to the square and the astronomical clock.',
  ],
  [
    'Prague',
    'Prague Castle',
    ActivityCategory.CULTURE,
    17,
    180,
    'Castle grounds, St Vitus Cathedral and Golden Lane on one ticket.',
  ],
  [
    'Tokyo',
    'TeamLab Planets',
    ActivityCategory.CULTURE,
    28,
    120,
    'Barefoot digital art installation; wear something you can roll up.',
  ],
  [
    'Tokyo',
    'Tsukiji outer market breakfast',
    ActivityCategory.FOOD,
    25,
    90,
    'Tamagoyaki, uni and grilled scallops from the stalls.',
  ],
  [
    'Tokyo',
    'Shibuya night walk',
    ActivityCategory.NIGHTLIFE,
    0,
    120,
    'The crossing, the backstreets and the yakitori alleys after dark.',
  ],
  [
    'Kyoto',
    'Fushimi Inari hike',
    ActivityCategory.NATURE,
    0,
    180,
    'Thousands of torii gates up the mountain. Two hours round trip.',
  ],
  [
    'Kyoto',
    'Tea ceremony',
    ActivityCategory.CULTURE,
    45,
    90,
    'A quiet hour of matcha and etiquette with a practising host.',
  ],
  [
    'Bangkok',
    'Grand Palace',
    ActivityCategory.SIGHTSEEING,
    15,
    150,
    'The royal complex and the Emerald Buddha. Cover shoulders and knees.',
  ],
  [
    'Bangkok',
    'Street food tour',
    ActivityCategory.FOOD,
    30,
    180,
    'Chinatown by tuk-tuk with eight stops and no menu.',
  ],
  [
    'Bali',
    'Ubud rice terrace trek',
    ActivityCategory.NATURE,
    20,
    240,
    'Morning walk through the Tegallalang terraces before the heat.',
  ],
  [
    'Bali',
    'Surf lesson in Canggu',
    ActivityCategory.ADVENTURE,
    35,
    120,
    'Two hours with a board, a rash guard and a patient instructor.',
  ],
  [
    'Singapore',
    'Gardens by the Bay',
    ActivityCategory.NATURE,
    20,
    150,
    'Supertree Grove plus the Cloud Forest dome and its indoor waterfall.',
  ],
  [
    'Jaipur',
    'Amber Fort',
    ActivityCategory.CULTURE,
    8,
    180,
    'Hilltop fort with mirrored halls; the sunrise light is worth the early start.',
  ],
  [
    'Jaipur',
    'Bazaar shopping walk',
    ActivityCategory.SHOPPING,
    5,
    120,
    'Johari and Bapu bazaars for block prints, bangles and silver.',
  ],
  [
    'Goa',
    'Beach day at Palolem',
    ActivityCategory.RELAXATION,
    0,
    300,
    'Crescent bay, calm water and shacks that will hold your bag.',
  ],
  [
    'Goa',
    'Scuba diving at Grande Island',
    ActivityCategory.ADVENTURE,
    45,
    240,
    'Two guided dives for beginners, equipment and boat included.',
  ],
  [
    'Udaipur',
    'Lake Pichola boat ride',
    ActivityCategory.SIGHTSEEING,
    12,
    60,
    'Sunset circuit past the palaces with a stop at Jag Mandir.',
  ],
  [
    'Dubai',
    'Desert safari',
    ActivityCategory.ADVENTURE,
    70,
    360,
    'Dune bashing, camels and a camp dinner under the stars.',
  ],
  [
    'Dubai',
    'Burj Khalifa observation deck',
    ActivityCategory.SIGHTSEEING,
    45,
    90,
    'Levels 124 and 125 at sunset; book the timed slot in advance.',
  ],
  [
    'New York',
    'Broadway show',
    ActivityCategory.CULTURE,
    120,
    180,
    'Orchestra seating for an evening performance in the Theater District.',
  ],
  [
    'New York',
    'Central Park bike ride',
    ActivityCategory.NATURE,
    25,
    120,
    'Rental and a loop of the park past the Reservoir and Bethesda Terrace.',
  ],
  [
    'Reykjavik',
    'Blue Lagoon',
    ActivityCategory.RELAXATION,
    80,
    240,
    'Geothermal bathing with a silica mask and a drink at the swim-up bar.',
  ],
  [
    'Reykjavik',
    'Northern lights tour',
    ActivityCategory.NATURE,
    95,
    300,
    'Coach out to dark skies with a guide who chases the forecast.',
  ],
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

  const cityByName = new Map((await prisma.city.findMany()).map((c) => [c.name, c] as const));

  for (const [cityName, name, category, cost, durationMinutes, description] of activities) {
    const city = cityByName.get(cityName);
    if (!city) continue;
    // Update rather than skip, so re-running the seed backfills fields that
    // were added after the row was first created.
    const existing = await prisma.activity.findFirst({ where: { cityId: city.id, name } });
    if (existing) {
      await prisma.activity.update({
        where: { id: existing.id },
        data: { category, cost, durationMinutes, description },
      });
      continue;
    }
    await prisma.activity.create({
      data: { cityId: city.id, name, category, cost, durationMinutes, description },
    });
  }

  const passwordHash = await bcrypt.hash('Password123', 10);

  const demo = await prisma.user.upsert({
    where: { email: 'demo@globetrotter.app' },
    create: {
      name: 'Demo Traveller',
      firstName: 'Demo',
      lastName: 'Traveller',
      email: 'demo@globetrotter.app',
      passwordHash,
      phone: '+91 98765 43210',
      bio: 'Chasing trains, temples and good coffee.',
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

  if (existingTrip) {
    await prisma.trip.update({
      where: { id: existingTrip.id },
      data: {
        coverPhotoUrl:
          'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=84',
      },
    });
  } else {
    const paris = cityByName.get('Paris')!;
    const rome = cityByName.get('Rome')!;
    const barcelona = cityByName.get('Barcelona')!;

    const parisActivities = await prisma.activity.findMany({
      where: { cityId: paris.id },
      take: 2,
    });
    const romeActivities = await prisma.activity.findMany({ where: { cityId: rome.id }, take: 2 });

    await prisma.trip.create({
      data: {
        userId: demo.id,
        name: 'European Summer Loop',
        description: 'Three cities, ten days, mostly trains and pastries.',
        coverPhotoUrl:
          'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=84',
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

  // Personal demo history across every trip filter and the current calendar.
  // Each name is stable, so this remains idempotent when the seed is re-run.
  const personalTrips = [
    {
      name: 'Goa Workation Week',
      description: 'A relaxed week of focused mornings, sunset swims and one diving day.',
      coverPhotoUrl:
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=1600&q=84',
      startOffset: -3,
      endOffset: 4,
      budgetLimit: 900,
      stops: [{ city: 'Goa', startOffset: -3, endOffset: 4, budget: 520 }],
      expenses: [
        { category: ExpenseCategory.TRANSPORT, label: 'Return train', amount: 85 },
        { category: ExpenseCategory.STAY, label: 'Beachside guesthouse', amount: 360 },
        { category: ExpenseCategory.MEALS, label: 'Cafes and dinners', amount: 140 },
      ],
    },
    {
      name: 'Rajasthan Weekend Memories',
      description: 'Rose-coloured streets, lake evenings and a notebook full of architecture.',
      coverPhotoUrl:
        'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1600&q=84',
      startOffset: -76,
      endOffset: -69,
      budgetLimit: 780,
      stops: [
        { city: 'Jaipur', startOffset: -76, endOffset: -73, budget: 300 },
        { city: 'Udaipur', startOffset: -73, endOffset: -69, budget: 280 },
      ],
      expenses: [
        { category: ExpenseCategory.TRANSPORT, label: 'Rail and transfers', amount: 120 },
        { category: ExpenseCategory.STAY, label: 'Heritage stays', amount: 310 },
        { category: ExpenseCategory.ACTIVITIES, label: 'Forts and lake cruise', amount: 95 },
      ],
    },
    {
      name: 'Japan Autumn Notes',
      description: 'Neon evenings in Tokyo followed by slow temple mornings in Kyoto.',
      coverPhotoUrl:
        'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1600&q=84',
      startOffset: 55,
      endOffset: 64,
      budgetLimit: 3200,
      stops: [
        { city: 'Tokyo', startOffset: 55, endOffset: 59, budget: 1100 },
        { city: 'Kyoto', startOffset: 59, endOffset: 64, budget: 900 },
      ],
      expenses: [
        { category: ExpenseCategory.TRANSPORT, label: 'Flights', amount: 980 },
        { category: ExpenseCategory.TRANSPORT, label: 'Rail pass', amount: 330 },
        { category: ExpenseCategory.STAY, label: 'Hotels and ryokan', amount: 1050 },
      ],
    },
  ];

  for (const tripSeed of personalTrips) {
    const existing = await prisma.trip.findFirst({
      where: { userId: demo.id, name: tripSeed.name },
    });
    if (existing) {
      await prisma.trip.update({
        where: { id: existing.id },
        data: { coverPhotoUrl: tripSeed.coverPhotoUrl },
      });
      continue;
    }

    const stops = [];
    for (const [index, stopSeed] of tripSeed.stops.entries()) {
      const city = cityByName.get(stopSeed.city);
      if (!city) continue;
      const catalogue = await prisma.activity.findMany({
        where: { cityId: city.id },
        orderBy: { name: 'asc' },
        take: 2,
      });
      stops.push({
        cityId: city.id,
        startDate: day(stopSeed.startOffset),
        endDate: day(stopSeed.endOffset),
        orderIndex: index,
        budget: stopSeed.budget,
        activities: {
          create: catalogue.map((activity, activityIndex) => ({
            activityId: activity.id,
            name: activity.name,
            cost: activity.cost,
            durationMinutes: activity.durationMinutes,
            scheduledDate: day(stopSeed.startOffset + Math.min(activityIndex + 1, 2)),
            startTime: activityIndex === 0 ? '09:30' : '15:00',
            orderIndex: activityIndex,
          })),
        },
      });
    }

    await prisma.trip.create({
      data: {
        userId: demo.id,
        name: tripSeed.name,
        description: tripSeed.description,
        coverPhotoUrl: tripSeed.coverPhotoUrl,
        startDate: day(tripSeed.startOffset),
        endDate: day(tripSeed.endOffset),
        budgetLimit: tripSeed.budgetLimit,
        stops: { create: stops },
        expenses: { create: tripSeed.expenses },
      },
    });
  }

  for (const cityName of ['Kyoto', 'Bali', 'Reykjavik', 'Udaipur']) {
    const city = cityByName.get(cityName);
    if (!city) continue;
    await prisma.savedDestination.upsert({
      where: { userId_cityId: { userId: demo.id, cityId: city.id } },
      create: { userId: demo.id, cityId: city.id },
      update: {},
    });
  }

  // A few more published itineraries so the community feed is not a single card.
  const community: {
    author: string;
    email: string;
    trip: string;
    blurb: string;
    cities: string[];
    slug: string;
    coverPhotoUrl: string;
  }[] = [
    {
      author: 'Meera Shah',
      email: 'meera@globetrotter.app',
      trip: 'Rajasthan in Ten Days',
      blurb: 'Forts, step-wells and far too much dal baati.',
      cities: ['Jaipur', 'Udaipur'],
      slug: 'demo-rajasthan',
      coverPhotoUrl:
        'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1600&q=84',
    },
    {
      author: 'Tomas Nowak',
      email: 'tomas@globetrotter.app',
      trip: 'Slow Japan',
      blurb: 'Two cities, no rushing, one rail pass.',
      cities: ['Tokyo', 'Kyoto'],
      slug: 'demo-slow-japan',
      coverPhotoUrl:
        'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1600&q=84',
    },
    {
      author: 'Aisha Rahman',
      email: 'aisha@globetrotter.app',
      trip: 'Southeast Asia on a Budget',
      blurb: 'Street food, beaches and under fifty a day.',
      cities: ['Bangkok', 'Bali'],
      slug: 'demo-sea-budget',
      coverPhotoUrl:
        'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=1600&q=84',
    },
  ];

  for (const entry of community) {
    const existing = await prisma.trip.findUnique({ where: { publicSlug: entry.slug } });
    if (existing) {
      await prisma.trip.update({
        where: { id: existing.id },
        data: { coverPhotoUrl: entry.coverPhotoUrl },
      });
      continue;
    }

    const [first, last] = entry.author.split(' ');
    const author = await prisma.user.upsert({
      where: { email: entry.email },
      create: {
        name: entry.author,
        firstName: first,
        lastName: last,
        email: entry.email,
        passwordHash,
      },
      update: {},
    });

    const stops = entry.cities
      .map((cityName, i) => {
        const city = cityByName.get(cityName);
        if (!city) return null;
        return {
          cityId: city.id,
          startDate: day(40 + i * 4),
          endDate: day(44 + i * 4),
          orderIndex: i,
          budget: 400 + i * 150,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    await prisma.trip.create({
      data: {
        userId: author.id,
        name: entry.trip,
        description: entry.blurb,
        coverPhotoUrl: entry.coverPhotoUrl,
        startDate: day(40),
        endDate: day(44 + (entry.cities.length - 1) * 4),
        isPublic: true,
        publicSlug: entry.slug,
        stops: { create: stops },
        expenses: {
          create: [
            { category: ExpenseCategory.TRANSPORT, label: 'Flights', amount: 480 },
            { category: ExpenseCategory.STAY, label: 'Accommodation', amount: 520 },
          ],
        },
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
