import { sql, relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
  check,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date());

// ---------------------------------------------------------------------------
// Enumerations (typed at the application layer; libSQL CHECK support is
// limited, so transitions are enforced in lib/db/guards.ts. Where a CHECK is
// cheap and load-bearing — worker consent — we add it as defense in depth.)
// ---------------------------------------------------------------------------

export const ORG_TYPES = ["source_agency", "recruitment_office"] as const;
export const VERIFICATION_STATUSES = ["pending", "verified", "rejected"] as const;
export const USER_ROLES = ["owner", "staff", "platform_admin"] as const;
export const WORKER_POSITIONS = ["housemaid", "driver", "cook", "caregiver", "other"] as const;
export const WORKER_STATUSES = [
  "draft",
  "available",
  "proposed",
  "reserved",
  "processing",
  "deployed",
  "inactive",
] as const;
export const JOB_ORDER_STATUSES = ["open", "in_review", "fulfilled", "cancelled", "expired"] as const;
export const PROPOSAL_STATUSES = ["pending", "shortlisted", "accepted", "rejected", "withdrawn"] as const;
export const PROPOSAL_WORKER_STATUSES = ["proposed", "selected", "rejected"] as const;
export const PLACEMENT_STAGES = [
  "contract",
  "visa",
  "medical",
  "ticketing",
  "okb",
  "traveled",
  "arrived",
  "cancelled",
] as const;
export const OKB_AIRLINES = ["etihad", "air_arabia", "flydubai", "flynas", "qatar", "other"] as const;
export const OKB_STATUSES = ["pending", "submitted", "approved", "rejected"] as const;
export const DOCUMENT_TYPES = ["passport", "medical", "contract", "visa", "ticket", "photo", "other"] as const;
export const INVITE_REQUEST_STATUSES = ["new", "approved", "dismissed"] as const;

export type OrgType = (typeof ORG_TYPES)[number];
export type WorkerStatus = (typeof WORKER_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type PlacementStage = (typeof PLACEMENT_STAGES)[number];

// ---------------------------------------------------------------------------
// Organizations & users (users doubles as the Better Auth `user` model)
// ---------------------------------------------------------------------------

export const organizations = sqliteTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  type: text("type", { enum: ORG_TYPES }).notNull(),
  country: text("country").notNull(),
  city: text("city"),
  licenseNumber: text("license_number"),
  licenseDocKey: text("license_doc_key"), // R2 object key
  verificationStatus: text("verification_status", { enum: VERIFICATION_STATUSES })
    .notNull()
    .default("pending"),
  rejectionReason: text("rejection_reason"),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const users = sqliteTable(
  "users",
  {
    id: id(),
    orgId: text("org_id").references(() => organizations.id), // null only for platform_admin
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull().default("owner"),
    // Better Auth required fields
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_org_idx").on(t.orgId)],
);

// --- Better Auth infrastructure tables ---

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    token: text("token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.token), index("sessions_user_idx").on(t.userId)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = sqliteTable("verifications", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// Invitations (registration is invite-only) + public invite requests queue
// ---------------------------------------------------------------------------

export const invitations = sqliteTable(
  "invitations",
  {
    id: id(),
    email: text("email").notNull(),
    orgType: text("org_type", { enum: ORG_TYPES }).notNull(),
    invitedByUserId: text("invited_by_user_id").references(() => users.id),
    token: text("token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invitations_token_idx").on(t.token), index("invitations_email_idx").on(t.email)],
);

export const inviteRequests = sqliteTable("invite_requests", {
  id: id(),
  orgName: text("org_name").notNull(),
  orgType: text("org_type", { enum: ORG_TYPES }).notNull(),
  country: text("country").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  status: text("status", { enum: INVITE_REQUEST_STATUSES }).notNull().default("new"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Workers & consents
//
// PRIVACY: worker rows must never be read across organizations except through
// canViewWorker() in lib/db/guards.ts. The CHECK below enforces rule #2 at the
// database layer: no worker leaves 'draft' without a signed consent on file.
// ---------------------------------------------------------------------------

export const workers = sqliteTable(
  "workers",
  {
    id: id(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => organizations.id),
    fullName: text("full_name").notNull(),
    dob: text("dob"), // ISO date string
    nationality: text("nationality").notNull(),
    passportNo: text("passport_no"),
    passportExpiry: text("passport_expiry"), // ISO date string
    position: text("position", { enum: WORKER_POSITIONS }).notNull(),
    experienceYears: integer("experience_years").notNull().default(0),
    languages: text("languages", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    skills: text("skills", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    salaryExpectation: real("salary_expectation"),
    photoKey: text("photo_key"), // R2, optional
    videoKey: text("video_key"), // R2, optional
    status: text("status", { enum: WORKER_STATUSES }).notNull().default("draft"),
    consentId: text("consent_id").references((): AnySQLiteColumn => consents.id),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("workers_agency_idx").on(t.agencyId),
    index("workers_status_idx").on(t.status),
    // Rule #2 at the DB layer: only drafts may exist without signed consent.
    check("workers_consent_required", sql`${t.status} = 'draft' OR ${t.consentId} IS NOT NULL`),
  ],
);

export const consents = sqliteTable(
  "consents",
  {
    id: id(),
    workerId: text("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    docKey: text("doc_key").notNull(), // signed consent PDF in R2
    signedDate: text("signed_date").notNull(), // ISO date string
    scope: text("scope", { enum: ["share_b2b"] })
      .notNull()
      .default("share_b2b"),
    createdAt: createdAt(),
  },
  (t) => [index("consents_worker_idx").on(t.workerId)],
);

// ---------------------------------------------------------------------------
// Job orders, proposals
// ---------------------------------------------------------------------------

export const jobOrders = sqliteTable(
  "job_orders",
  {
    id: id(),
    officeId: text("office_id")
      .notNull()
      .references(() => organizations.id),
    position: text("position", { enum: WORKER_POSITIONS }).notNull(),
    nationalityPref: text("nationality_pref"),
    quantity: integer("quantity").notNull().default(1),
    salaryOffer: real("salary_offer"),
    currency: text("currency").notNull().default("JOD"),
    contractMonths: integer("contract_months").notNull().default(24),
    targetTravelDate: text("target_travel_date"), // ISO date string
    specialRequirements: text("special_requirements"),
    status: text("status", { enum: JOB_ORDER_STATUSES }).notNull().default("open"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("job_orders_office_idx").on(t.officeId), index("job_orders_status_idx").on(t.status)],
);

export const proposals = sqliteTable(
  "proposals",
  {
    id: id(),
    jobOrderId: text("job_order_id")
      .notNull()
      .references(() => jobOrders.id),
    agencyId: text("agency_id")
      .notNull()
      .references(() => organizations.id),
    status: text("status", { enum: PROPOSAL_STATUSES }).notNull().default("pending"),
    message: text("message"),
    createdAt: createdAt(),
  },
  (t) => [
    index("proposals_job_order_idx").on(t.jobOrderId),
    index("proposals_agency_idx").on(t.agencyId),
    uniqueIndex("proposals_job_agency_idx").on(t.jobOrderId, t.agencyId),
  ],
);

export const proposalWorkers = sqliteTable(
  "proposal_workers",
  {
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    workerId: text("worker_id")
      .notNull()
      .references(() => workers.id),
    status: text("status", { enum: PROPOSAL_WORKER_STATUSES }).notNull().default("proposed"),
  },
  (t) => [
    primaryKey({ columns: [t.proposalId, t.workerId] }),
    index("proposal_workers_worker_idx").on(t.workerId),
  ],
);

// ---------------------------------------------------------------------------
// Placements & OKB (ok-to-board) requests
// ---------------------------------------------------------------------------

export const placements = sqliteTable(
  "placements",
  {
    id: id(),
    workerId: text("worker_id")
      .notNull()
      .references(() => workers.id),
    jobOrderId: text("job_order_id")
      .notNull()
      .references(() => jobOrders.id),
    officeId: text("office_id")
      .notNull()
      .references(() => organizations.id),
    agencyId: text("agency_id")
      .notNull()
      .references(() => organizations.id),
    stage: text("stage", { enum: PLACEMENT_STAGES }).notNull().default("contract"),
    stageUpdatedAt: integer("stage_updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("placements_worker_idx").on(t.workerId),
    index("placements_office_idx").on(t.officeId),
    index("placements_agency_idx").on(t.agencyId),
  ],
);

export const okbRequests = sqliteTable(
  "okb_requests",
  {
    id: id(),
    placementId: text("placement_id")
      .notNull()
      .references(() => placements.id),
    airline: text("airline", { enum: OKB_AIRLINES }).notNull(),
    flightNo: text("flight_no"),
    pnr: text("pnr"),
    travelDate: text("travel_date"), // ISO date string
    route: text("route"),
    status: text("status", { enum: OKB_STATUSES }).notNull().default("pending"),
    submittedAt: integer("submitted_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("okb_requests_placement_idx").on(t.placementId)],
);

// ---------------------------------------------------------------------------
// Documents (passports, medicals, contracts — R2 keys only, never public URLs)
// ---------------------------------------------------------------------------

export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    ownerOrgId: text("owner_org_id")
      .notNull()
      .references(() => organizations.id),
    workerId: text("worker_id").references(() => workers.id),
    placementId: text("placement_id").references(() => placements.id),
    type: text("type", { enum: DOCUMENT_TYPES }).notNull(),
    fileKey: text("file_key").notNull(), // R2 object key
    fileName: text("file_name").notNull(),
    expiryDate: text("expiry_date"), // ISO date string, scanned by daily cron
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("documents_owner_idx").on(t.ownerOrgId),
    index("documents_worker_idx").on(t.workerId),
    index("documents_file_key_idx").on(t.fileKey),
  ],
);

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export const threads = sqliteTable(
  "threads",
  {
    id: id(),
    proposalId: text("proposal_id").references(() => proposals.id),
    placementId: text("placement_id").references(() => placements.id),
    createdAt: createdAt(),
  },
  (t) => [index("threads_proposal_idx").on(t.proposalId), index("threads_placement_idx").on(t.placementId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
    readAt: integer("read_at", { mode: "timestamp" }),
  },
  (t) => [index("messages_thread_idx").on(t.threadId)],
);

// ---------------------------------------------------------------------------
// Audit log (rule #4: every cross-org worker read is recorded)
// ---------------------------------------------------------------------------

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    actorUserId: text("actor_user_id"),
    actorOrgId: text("actor_org_id"),
    action: text("action").notNull(), // e.g. 'worker.viewed', 'proposal.created'
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    context: text("context", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_actor_org_idx").on(t.actorOrgId),
  ],
);

// ---------------------------------------------------------------------------
// In-app notifications (document expiry, job order expiry, proposal events)
// ---------------------------------------------------------------------------

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    type: text("type").notNull(), // e.g. 'document.expiring', 'job_order.expired'
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_org_idx").on(t.orgId)],
);

// ---------------------------------------------------------------------------
// Relations (for db.query.*)
// ---------------------------------------------------------------------------

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  workers: many(workers),
  jobOrders: many(jobOrders),
  proposals: many(proposals),
}));

export const usersRelations = relations(users, ({ one }) => ({
  org: one(organizations, { fields: [users.orgId], references: [organizations.id] }),
}));

export const workersRelations = relations(workers, ({ one, many }) => ({
  agency: one(organizations, { fields: [workers.agencyId], references: [organizations.id] }),
  consent: one(consents, { fields: [workers.consentId], references: [consents.id] }),
  proposalWorkers: many(proposalWorkers),
  placements: many(placements),
  documents: many(documents),
}));

export const consentsRelations = relations(consents, ({ one }) => ({
  worker: one(workers, { fields: [consents.workerId], references: [workers.id] }),
}));

export const jobOrdersRelations = relations(jobOrders, ({ one, many }) => ({
  office: one(organizations, { fields: [jobOrders.officeId], references: [organizations.id] }),
  proposals: many(proposals),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  jobOrder: one(jobOrders, { fields: [proposals.jobOrderId], references: [jobOrders.id] }),
  agency: one(organizations, { fields: [proposals.agencyId], references: [organizations.id] }),
  workers: many(proposalWorkers),
  threads: many(threads),
}));

export const proposalWorkersRelations = relations(proposalWorkers, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalWorkers.proposalId], references: [proposals.id] }),
  worker: one(workers, { fields: [proposalWorkers.workerId], references: [workers.id] }),
}));

export const placementsRelations = relations(placements, ({ one, many }) => ({
  worker: one(workers, { fields: [placements.workerId], references: [workers.id] }),
  jobOrder: one(jobOrders, { fields: [placements.jobOrderId], references: [jobOrders.id] }),
  office: one(organizations, { fields: [placements.officeId], references: [organizations.id] }),
  agency: one(organizations, { fields: [placements.agencyId], references: [organizations.id] }),
  okbRequests: many(okbRequests),
  threads: many(threads),
}));

export const okbRequestsRelations = relations(okbRequests, ({ one }) => ({
  placement: one(placements, { fields: [okbRequests.placementId], references: [placements.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  ownerOrg: one(organizations, { fields: [documents.ownerOrgId], references: [organizations.id] }),
  worker: one(workers, { fields: [documents.workerId], references: [workers.id] }),
  placement: one(placements, { fields: [documents.placementId], references: [placements.id] }),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  proposal: one(proposals, { fields: [threads.proposalId], references: [proposals.id] }),
  placement: one(placements, { fields: [threads.placementId], references: [placements.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(threads, { fields: [messages.threadId], references: [threads.id] }),
  sender: one(users, { fields: [messages.senderUserId], references: [users.id] }),
}));

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Worker = typeof workers.$inferSelect;
export type Consent = typeof consents.$inferSelect;
export type JobOrder = typeof jobOrders.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type ProposalWorker = typeof proposalWorkers.$inferSelect;
export type Placement = typeof placements.$inferSelect;
export type OkbRequest = typeof okbRequests.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
