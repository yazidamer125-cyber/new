import { z } from "zod";
import {
  ORG_TYPES,
  WORKER_POSITIONS,
  WORKER_STATUSES,
  PROPOSAL_WORKER_STATUSES,
  PLACEMENT_STAGES,
  OKB_AIRLINES,
  OKB_STATUSES,
  DOCUMENT_TYPES,
} from "@/lib/db/schema";
import { UPLOAD_KINDS } from "@/lib/r2";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date (YYYY-MM-DD)");

export const registerSchema = z.object({
  token: z.string().min(10),
  orgName: z.string().min(2).max(120),
  country: z.string().min(2).max(60),
  city: z.string().max(60).optional(),
  licenseNumber: z.string().max(60).optional(),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(10).max(128),
});

export const requestInviteSchema = z.object({
  orgName: z.string().min(2).max(120),
  orgType: z.enum(ORG_TYPES),
  country: z.string().min(2).max(60),
  contactName: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  message: z.string().max(1000).optional(),
});

export const workerUpsertSchema = z.object({
  fullName: z.string().min(2).max(120),
  dob: isoDate.optional().nullable(),
  nationality: z.string().min(2).max(60),
  passportNo: z.string().max(30).optional().nullable(),
  passportExpiry: isoDate.optional().nullable(),
  position: z.enum(WORKER_POSITIONS),
  experienceYears: z.coerce.number().int().min(0).max(50).default(0),
  languages: z.array(z.string().min(1).max(40)).max(10).default([]),
  skills: z.array(z.string().min(1).max(60)).max(25).default([]),
  salaryExpectation: z.coerce.number().min(0).max(100000).optional().nullable(),
  photoKey: z.string().max(300).optional().nullable(),
  videoKey: z.string().max(300).optional().nullable(),
});

export const consentSchema = z.object({
  docKey: z.string().min(5).max(300),
  signedDate: isoDate.refine((d) => new Date(d) <= new Date(), "Signed date cannot be in the future"),
});

export const workerStatusSchema = z.object({
  status: z.enum(WORKER_STATUSES),
});

export const jobOrderSchema = z.object({
  position: z.enum(WORKER_POSITIONS),
  nationalityPref: z.string().max(60).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(500).default(1),
  salaryOffer: z.coerce.number().min(0).max(100000).optional().nullable(),
  currency: z.string().min(3).max(5).default("JOD"),
  contractMonths: z.coerce.number().int().min(3).max(60).default(24),
  targetTravelDate: isoDate.optional().nullable(),
  specialRequirements: z.string().max(2000).optional().nullable(),
  expiresInDays: z.coerce.number().int().min(7).max(180).default(60),
});

export const jobOrderStatusSchema = z.object({
  status: z.enum(["open", "in_review", "fulfilled", "cancelled"]),
});

export const proposalCreateSchema = z.object({
  jobOrderId: z.string().min(1),
  workerIds: z.array(z.string().min(1)).min(1).max(30),
  message: z.string().max(2000).optional(),
});

export const marketplaceRequestSchema = z.object({
  workerId: z.string().min(1),
  jobOrderId: z.string().min(1),
  message: z.string().max(2000).optional(),
});

export const proposalStatusSchema = z.object({
  status: z.enum(["shortlisted", "accepted", "rejected", "withdrawn"]),
});

export const proposalWorkerStatusSchema = z.object({
  status: z.enum(PROPOSAL_WORKER_STATUSES),
});

export const placementStageSchema = z.object({
  stage: z.enum(PLACEMENT_STAGES),
  notes: z.string().max(2000).optional(),
});

export const okbCreateSchema = z.object({
  placementId: z.string().min(1),
  airline: z.enum(OKB_AIRLINES),
  flightNo: z.string().max(12).optional().nullable(),
  pnr: z.string().max(10).optional().nullable(),
  travelDate: isoDate.optional().nullable(),
  route: z.string().max(60).optional().nullable(),
});

export const okbStatusSchema = z.object({
  status: z.enum(OKB_STATUSES),
});

export const messageSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const invitationCreateSchema = z.object({
  email: z.string().email(),
  orgType: z.enum(ORG_TYPES),
  expiresInDays: z.coerce.number().int().min(1).max(60).default(14),
});

export const orgRejectSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const orgEditSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  country: z.string().min(2).max(60).optional(),
  city: z.string().max(60).optional().nullable(),
  licenseNumber: z.string().max(60).optional().nullable(),
});

export const orgSuspendSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const licenseSchema = z.object({
  licenseNumber: z.string().min(2).max(60),
  licenseDocKey: z.string().min(5).max(300),
});

const uploadKinds = Object.keys(UPLOAD_KINDS) as [keyof typeof UPLOAD_KINDS, ...(keyof typeof UPLOAD_KINDS)[]];

export const uploadSignSchema = z.object({
  kind: z.enum(uploadKinds),
  contentType: z.string().min(3).max(100),
  workerId: z.string().optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  fileName: z.string().max(200).optional(),
});

export const documentCreateSchema = z.object({
  fileKey: z.string().min(5).max(300),
  fileName: z.string().min(1).max(200),
  type: z.enum(DOCUMENT_TYPES),
  workerId: z.string().optional().nullable(),
  placementId: z.string().optional().nullable(),
  expiryDate: isoDate.optional().nullable(),
});
