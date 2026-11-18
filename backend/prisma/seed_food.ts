import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedFood() {
  console.log('🍽️ Seeding Food Owner & Menu Items...');

  // 1. Ensure Food Owner User exists
  const existingFoodOwner = await prisma.user.findUnique({
    where: { email: 'foodowner@techcorp.com' },
  });

    let foodUser = await prisma.user.findUnique({
      where: { email: 'foodowner@techcorp.com' },
      include: { employee: true },
    });

    if (!foodUser) {
      const password = await bcrypt.hash('Food@123', 12);
      foodUser = await prisma.user.create({
        data: {
          email: 'foodowner@techcorp.com',
          password,
          role: 'FOOD_OWNER',
          isRegistered: true,
        },
        include: { employee: true },
      });
      console.log('✅ Created Food Owner: foodowner@techcorp.com / Food@123');
    } else {
      await prisma.user.update({
        where: { email: 'foodowner@techcorp.com' },
        data: { role: 'FOOD_OWNER', isRegistered: true },
      });
      console.log('ℹ️ Updated existing Food Owner role to FOOD_OWNER');
    }

    // Ensure cafeteria department and employee profile exist
    let dept = await prisma.department.findFirst({ where: { name: 'Cafeteria & Food Services' } });
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          name: 'Cafeteria & Food Services',
          description: 'Cafeteria and Workplace Dining Amenities',
        },
      });
    }

    if (!foodUser.employee) {
      await prisma.employee.create({
        data: {
          employeeId: 'FO001',
          userId: foodUser.id,
          name: 'Cafeteria & Food Services',
          email: foodUser.email,
          phone: '+91 9876543099',
          departmentId: dept.id,
          designation: 'Cafeteria Manager',
          joiningDate: new Date('2023-01-01'),
          status: 'ACTIVE',
        },
      });
      console.log('✅ Created Employee record for Food Owner');
    }

  // 2. Seed Default Menu Items
  const items = [
    // Tea & Coffee
    {
      name: 'Masala Chai',
      category: 'Tea & Coffee',
      price: 15,
      description: 'Traditional Indian spiced milk tea brewed with cardamom, cloves, and ginger.',
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Special Ginger Tea',
      category: 'Tea & Coffee',
      price: 15,
      description: 'Strong hot tea infused with fresh crushed ginger.',
      imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'South Indian Filter Coffee',
      category: 'Tea & Coffee',
      price: 25,
      description: 'Authentic frothy South Indian decoction coffee with creamy milk.',
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Organic Green Tea',
      category: 'Tea & Coffee',
      price: 20,
      description: 'Antioxidant-rich herbal green tea served with lemon & honey.',
      imageUrl: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Chilled Cold Coffee',
      category: 'Tea & Coffee',
      price: 40,
      description: 'Refreshing thick blended iced coffee with milk and chocolate drizzle.',
      imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },

    // Milk
    {
      name: 'Hot Badam Milk',
      category: 'Milk',
      price: 35,
      description: 'Warm almond milk flavored with saffron strands, pistachios, and cardamom.',
      imageUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Turmeric Golden Milk',
      category: 'Milk',
      price: 30,
      description: 'Immunity-boosting warm golden milk with turmeric, black pepper, and honey.',
      imageUrl: 'https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Hot Chocolate Milk',
      category: 'Milk',
      price: 35,
      description: 'Smooth, creamy steaming hot chocolate prepared with pure dairy milk.',
      imageUrl: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Plain Steamed Milk',
      category: 'Milk',
      price: 20,
      description: 'Fresh warm whole milk served with or without sugar as per preference.',
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },

    // Snacks
    {
      name: 'Crispy Samosa (2 pcs)',
      category: 'Snacks',
      price: 30,
      description: 'Crispy golden pastries stuffed with spiced potatoes, served with mint & tamarind chutneys.',
      imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Veg Grilled Sandwich',
      category: 'Snacks',
      price: 50,
      description: 'Triple-decker sandwich with cucumber, tomato, potato, green chutney, and cheese.',
      imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Crispy Veg Cutlet (2 pcs)',
      category: 'Snacks',
      price: 35,
      description: 'Hearty breaded vegetable patties crisp-fried with tangy dip.',
      imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Spicy Bread Pakora',
      category: 'Snacks',
      price: 25,
      description: 'Gram flour battered deep-fried bread stuffed with mashed masala potatoes.',
      imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Salted French Fries',
      category: 'Snacks',
      price: 45,
      description: 'Crispy golden potato fries lightly tossed with sea salt and peri-peri sprinkle.',
      imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },

    // Bakery
    {
      name: 'Flaky Veg Puff',
      category: 'Bakery',
      price: 25,
      description: 'Golden puff pastry layered with aromatic spiced vegetable filling.',
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Fresh Paneer Puff',
      category: 'Bakery',
      price: 35,
      description: 'Buttery flaky pastry filled with marinated cottage cheese cubes and herbs.',
      imageUrl: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Double Choc Chip Cookie',
      category: 'Bakery',
      price: 20,
      description: 'Soft-baked Belgian chocolate chunk cookie, rich and chewy.',
      imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Butter Croissant',
      category: 'Bakery',
      price: 45,
      description: 'Light, airy, multi-layered French croissant baked fresh daily.',
      imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
    {
      name: 'Blueberry Crumble Muffin',
      category: 'Bakery',
      price: 40,
      description: 'Moist golden muffin packed with sweet juicy wild blueberries.',
      imageUrl: 'https://images.unsplash.com/photo-1586985289906-406988974504?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
    },
  ];

  for (const item of items) {
    const existing = await prisma.foodItem.findFirst({
      where: { name: item.name },
    });
    if (!existing) {
      await prisma.foodItem.create({ data: item });
      console.log(`+ Created item: ${item.name} (${item.category} - Rs.${item.price})`);
    }
  }

  console.log('🎉 Food Owner and Menu seeding completed successfully!');
}

seedFood()
  .catch((e) => {
    console.error('Error seeding food:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
