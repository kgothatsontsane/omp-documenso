import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

const orgUrl = process.argv[2] || 'open-mic-productions';

async function main() {
  const org = await prisma.organisation.findFirst({
    where: { url: orgUrl },
    select: { id: true, name: true, customerId: true, subscription: true },
  });

  if (!org) {
    console.error('Organisation not found:', orgUrl);
    process.exit(1);
  }

  console.log('Organisation found:', org.name, org.id);

  if (org.customerId) {
    console.log('Organisation already has a customerId:', org.customerId);
  } else {
    console.log('Organisation does not have a customerId');
  }

  if (org.subscription) {
    console.log('Organisation already has a subscription:', org.subscription);
  } else {
    console.log('Creating enterprise subscription for organisation...');
    const newSubscription = await prisma.subscription.create({
      data: {
        status: 'ACTIVE',
        planId: `sub_enterprise_manual_${org.id}`,
        priceId: `price_enterprise_manual`,
        customerId: org.customerId || `cust_enterprise_manual_${org.id}`,
        organisationId: org.id,
      },
    });
    console.log('Subscription created:', newSubscription);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
