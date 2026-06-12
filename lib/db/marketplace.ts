import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from ".";
import { workers, organizations } from "./schema";
import { logAction } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/helpers";

/**
 * Marketplace = every 'available' worker with a signed consent, from every
 * verified agency, shown to every verified recruitment office — but REDACTED:
 * masked name, no photo, no passport, no exact birth date. The full profile
 * still requires a proposal (created when the office requests the worker), so
 * canViewWorker() remains the only path to full worker data.
 */
export type MarketplaceCard = {
  id: string;
  displayName: string;
  nationality: string;
  position: string;
  experienceYears: number;
  languages: string[];
  skills: string[];
  salaryExpectation: number | null;
  age: number | null;
  agencyId: string;
  agencyName: string;
  agencyCountry: string;
};

/** "Abeba Tesfaye" → "Abeba T." — full name only after a proposal exists. */
export function maskWorkerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName.trim();
  return `${parts[0]} ${parts
    .slice(1)
    .map((p) => `${p[0]}.`)
    .join(" ")}`;
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const ms = Date.now() - new Date(dob).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.floor(ms / (365.25 * 86_400_000));
}

/** Lists marketplace cards for a verified office and audit-logs the browse. */
export async function listMarketplaceForOffice(ctx: SessionContext & { org: { id: string } }): Promise<MarketplaceCard[]> {
  const rows = await db
    .select({
      id: workers.id,
      fullName: workers.fullName,
      dob: workers.dob,
      nationality: workers.nationality,
      position: workers.position,
      experienceYears: workers.experienceYears,
      languages: workers.languages,
      skills: workers.skills,
      salaryExpectation: workers.salaryExpectation,
      updatedAt: workers.updatedAt,
      agencyId: organizations.id,
      agencyName: organizations.name,
      agencyCountry: organizations.country,
    })
    .from(workers)
    .innerJoin(organizations, eq(workers.agencyId, organizations.id))
    .where(
      and(
        eq(workers.status, "available"),
        isNotNull(workers.consentId),
        eq(organizations.verificationStatus, "verified"),
      ),
    )
    .orderBy(desc(workers.updatedAt));

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "marketplace.viewed",
    entityType: "marketplace",
    entityId: ctx.org.id,
    context: { count: rows.length, workerIds: rows.slice(0, 100).map((r) => r.id) },
  });

  return rows.map((r) => ({
    id: r.id,
    displayName: maskWorkerName(r.fullName),
    nationality: r.nationality,
    position: r.position,
    experienceYears: r.experienceYears,
    languages: r.languages,
    skills: r.skills,
    salaryExpectation: r.salaryExpectation,
    age: ageFromDob(r.dob),
    agencyId: r.agencyId,
    agencyName: r.agencyName,
    agencyCountry: r.agencyCountry,
  }));
}
