import { PrismaClient, Role, Condition } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding DSLR WORLD database...');

  // ─── Admin User ──────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Admin@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dslrworld.in' },
    update: {},
    create: {
      name: 'DSLR WORLD Admin',
      email: 'admin@dslrworld.in',
      phone: '9999999999',
      password: hashedPassword,
      role: Role.ADMIN,
      isVerified: true,
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // ─── Categories ───────────────────────────────────────────────
  const categories = [
    {
      name: 'DSLR Cameras',
      slug: 'dslr-cameras',
      description: 'Professional and consumer DSLR cameras from top brands',
    },
    {
      name: 'Mirrorless Cameras',
      slug: 'mirrorless-cameras',
      description: 'Compact mirrorless cameras with interchangeable lenses',
    },
    {
      name: 'Lenses',
      slug: 'lenses',
      description: 'Wide-angle, telephoto, macro and prime lenses',
    },
    {
      name: 'Accessories',
      slug: 'accessories',
      description: 'Tripods, bags, filters, batteries and more',
    },
    {
      name: 'Action Cameras',
      slug: 'action-cameras',
      description: 'GoPro and other action cameras for adventure photography',
    },
    {
      name: 'Second-Hand',
      slug: 'second-hand',
      description: 'Certified pre-owned cameras and equipment at great prices',
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ ${categories.length} categories seeded`);

  // ─── Sample Products ──────────────────────────────────────────
  const dsrlCat = await prisma.category.findUnique({ where: { slug: 'dslr-cameras' } });
  const lensesCat = await prisma.category.findUnique({ where: { slug: 'lenses' } });
  const secondHandCat = await prisma.category.findUnique({ where: { slug: 'second-hand' } });

  if (dsrlCat && lensesCat && secondHandCat) {
    const products = [
      {
        name: 'Canon EOS 1500D 24.1MP DSLR Camera',
        slug: 'canon-eos-1500d-241mp-dslr-camera',
        description:
          'Entry-level DSLR camera with 24.1MP APS-C CMOS sensor, DIGIC 4+ processor, 9-point AF system. Perfect for beginners stepping into professional photography.',
        price: 3299900, // ₹32,999 in paise
        mrp: 3799900,
        discount: 13,
        stock: 15,
        condition: Condition.NEW,
        brand: 'Canon',
        model: 'EOS 1500D',
        categoryId: dsrlCat.id,
        isFeatured: true,
        images: [],
      },
      {
        name: 'Nikon D3500 24.2MP DSLR Camera',
        slug: 'nikon-d3500-242mp-dslr-camera',
        description:
          'Nikon D3500 with 24.2MP sensor, no optical low-pass filter, EXPEED 4 processor. Incredible battery life of up to 1500 shots. Ideal for beginners.',
        price: 3499900,
        mrp: 4499900,
        discount: 22,
        stock: 10,
        condition: Condition.NEW,
        brand: 'Nikon',
        model: 'D3500',
        categoryId: dsrlCat.id,
        isFeatured: true,
        images: [],
      },
      {
        name: 'Canon 50mm f/1.8 STM Lens',
        slug: 'canon-50mm-f18-stm-lens',
        description:
          'The "nifty fifty" — Canon EF 50mm f/1.8 STM lens with fast, quiet autofocus. Great for portraits, street photography and low-light shooting.',
        price: 1299900,
        mrp: 1499900,
        discount: 13,
        stock: 25,
        condition: Condition.NEW,
        brand: 'Canon',
        model: 'EF 50mm f/1.8 STM',
        categoryId: lensesCat.id,
        isFeatured: false,
        images: [],
      },
      {
        name: 'Canon EOS 700D DSLR — Certified Pre-Owned',
        slug: 'canon-eos-700d-dslr-certified-pre-owned',
        description:
          'Certified second-hand Canon EOS 700D with 18MP sensor. Thoroughly tested, 6-month warranty. Comes with 18-55mm kit lens. Shutter count: ~15,000.',
        price: 1799900,
        mrp: 2999900,
        discount: 40,
        stock: 3,
        condition: Condition.SECOND_HAND,
        brand: 'Canon',
        model: 'EOS 700D',
        categoryId: secondHandCat.id,
        isFeatured: true,
        images: [],
      },
    ];

    for (const product of products) {
      await prisma.product.upsert({
        where: { slug: product.slug },
        update: {},
        create: product,
      });
    }
    console.log(`✅ ${products.length} sample products seeded`);
  }

  console.log('🎉 Database seeding complete!');
  console.log('');
  console.log('Admin Credentials:');
  console.log('  Email: admin@dslrworld.in');
  console.log('  Password: Admin@123');
  console.log('  ⚠️  Change the password immediately in production!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
