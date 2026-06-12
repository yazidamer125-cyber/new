/**
 * Seed script.
 *   npm run db:seed         → --profile=dev            (2 demo orgs, 1 admin, sample job order,
 *                                                       plus consented workers + a proposal to play with)
 *   npm run db:seed:demo    → --profile=production-demo (admin, verified Jordanian office,
 *                                                       verified Ethiopian agency, 3 draft workers
 *                                                       WITHOUT consent, 1 open job order)
 *
 * Run migrations first: npm run db:migrate
 */
process.env.WAKILPRO_SCRIPT = "1"; // disables the nextCookies plugin outside Next.js

import "dotenv/config";
import { eq } from "drizzle-orm";

const PROFILE = process.argv.includes("--profile=production-demo") ? "production-demo" : "dev";
const PASSWORD = process.env.SEED_PASSWORD ?? "Wakil-Demo-2026!";

async function main() {
  const { db } = await import("../lib/db");
  const { users, organizations, workers, consents, jobOrders } = await import("../lib/db/schema");
  const { auth, INTERNAL_SIGNUP_HEADER } = await import("../lib/auth");

  const internalHeaders = new Headers({ [INTERNAL_SIGNUP_HEADER]: process.env.BETTER_AUTH_SECRET ?? "" });

  async function createUser(email: string, name: string, role: "owner" | "platform_admin", orgId: string | null) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      console.log(`• user ${email} already exists — skipping`);
      return existing.id;
    }
    const res = await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name },
      headers: internalHeaders,
    });
    await db.update(users).set({ orgId, role }).where(eq(users.id, res.user.id));
    console.log(`✓ user ${email} (${role})`);
    return res.user.id;
  }

  console.log(`Seeding profile: ${PROFILE}`);

  // 1. Platform admin (no org).
  await createUser("admin@wakilpro.local", "مشرف المنصة", "platform_admin", null);

  // 2. Verified Jordanian recruitment office.
  let office = await db.query.organizations.findFirst({ where: eq(organizations.name, "مكتب عمّان للاستقدام (تجريبي)") });
  if (!office) {
    [office] = await db
      .insert(organizations)
      .values({
        name: "مكتب عمّان للاستقدام (تجريبي)",
        type: "recruitment_office",
        country: "الأردن",
        city: "عمّان",
        licenseNumber: "JO-REC-2026-001",
        licenseDocKey: null,
        verificationStatus: "verified",
        verifiedAt: new Date(),
      })
      .returning();
    console.log("✓ org: Jordanian office (verified)");
  }
  await createUser("office@demo.wakilpro.local", "مدير المكتب", "owner", office.id);

  // 3. Verified Ethiopian source agency.
  let agency = await db.query.organizations.findFirst({ where: eq(organizations.name, "وكالة أديس للتوريد (تجريبي)") });
  if (!agency) {
    [agency] = await db
      .insert(organizations)
      .values({
        name: "وكالة أديس للتوريد (تجريبي)",
        type: "source_agency",
        country: "إثيوبيا",
        city: "أديس أبابا",
        licenseNumber: "ET-SRC-2026-014",
        licenseDocKey: null,
        verificationStatus: "verified",
        verifiedAt: new Date(),
      })
      .returning();
    console.log("✓ org: Ethiopian agency (verified)");
  }
  await createUser("agency@demo.wakilpro.local", "مديرة الوكالة", "owner", agency.id);

  // 4. One open job order from the office.
  const existingOrder = await db.query.jobOrders.findFirst({ where: eq(jobOrders.officeId, office.id) });
  if (!existingOrder) {
    await db.insert(jobOrders).values({
      officeId: office.id,
      position: "housemaid",
      nationalityPref: "إثيوبية",
      quantity: 5,
      salaryOffer: 250,
      currency: "JOD",
      contractMonths: 24,
      targetTravelDate: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
      specialRequirements: "خبرة سابقة سنتان على الأقل، لغة عربية أو إنجليزية أساسية.",
      status: "open",
      expiresAt: new Date(Date.now() + 60 * 86_400_000),
    });
    console.log("✓ open job order (housemaid × 5)");
  }

  // 5. Workers.
  const demoWorkers = [
    { fullName: "Abeba Tesfaye", nationality: "إثيوبية", position: "housemaid" as const, experienceYears: 3, languages: ["أمهرية", "عربي أساسي"], skills: ["تنظيف", "طبخ منزلي"], dob: "1996-04-12" },
    { fullName: "Hiwot Bekele", nationality: "إثيوبية", position: "caregiver" as const, experienceYears: 5, languages: ["أمهرية", "إنجليزي"], skills: ["رعاية مسنين", "إسعافات أولية"], dob: "1992-11-03" },
    { fullName: "Marta Alemu", nationality: "إثيوبية", position: "cook" as const, experienceYears: 4, languages: ["أمهرية", "عربي"], skills: ["مطبخ شرقي", "معجنات"], dob: "1994-07-21" },
  ];

  const existingWorker = await db.query.workers.findFirst({ where: eq(workers.agencyId, agency.id) });
  if (!existingWorker) {
    for (const [i, w] of demoWorkers.entries()) {
      const [row] = await db.insert(workers).values({ ...w, agencyId: agency.id, status: "draft" }).returning();
      // Dev profile: give the first two workers signed consents and make them
      // available so the full proposal flow can be exercised immediately.
      // Production-demo: per spec, all three stay draft WITHOUT consent.
      if (PROFILE === "dev" && i < 2) {
        const [consent] = await db
          .insert(consents)
          .values({
            workerId: row.id,
            docKey: `org/${agency.id}/workers/${row.id}/consent/seed-placeholder.pdf`,
            signedDate: new Date().toISOString().slice(0, 10),
            scope: "share_b2b",
          })
          .returning();
        await db.update(workers).set({ consentId: consent.id, status: "available" }).where(eq(workers.id, row.id));
      }
    }
    console.log(`✓ ${demoWorkers.length} workers (${PROFILE === "dev" ? "2 available with consent, 1 draft" : "all draft, no consent"})`);
  }

  console.log("\nDone. Demo credentials:");
  console.log(`  admin@wakilpro.local / ${PASSWORD}`);
  console.log(`  office@demo.wakilpro.local / ${PASSWORD}`);
  console.log(`  agency@demo.wakilpro.local / ${PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
