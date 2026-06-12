CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`actor_org_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`context` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_org_idx` ON `audit_log` (`actor_org_id`);--> statement-breakpoint
CREATE TABLE `consents` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`doc_key` text NOT NULL,
	`signed_date` text NOT NULL,
	`scope` text DEFAULT 'share_b2b' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `consents_worker_idx` ON `consents` (`worker_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_org_id` text NOT NULL,
	`worker_id` text,
	`placement_id` text,
	`type` text NOT NULL,
	`file_key` text NOT NULL,
	`file_name` text NOT NULL,
	`expiry_date` text,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`placement_id`) REFERENCES `placements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `documents_owner_idx` ON `documents` (`owner_org_id`);--> statement-breakpoint
CREATE INDEX `documents_worker_idx` ON `documents` (`worker_id`);--> statement-breakpoint
CREATE INDEX `documents_file_key_idx` ON `documents` (`file_key`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`org_type` text NOT NULL,
	`invited_by_user_id` text,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_idx` ON `invitations` (`token`);--> statement-breakpoint
CREATE INDEX `invitations_email_idx` ON `invitations` (`email`);--> statement-breakpoint
CREATE TABLE `invite_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`org_name` text NOT NULL,
	`org_type` text NOT NULL,
	`country` text NOT NULL,
	`contact_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`message` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`office_id` text NOT NULL,
	`position` text NOT NULL,
	`nationality_pref` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`salary_offer` real,
	`currency` text DEFAULT 'JOD' NOT NULL,
	`contract_months` integer DEFAULT 24 NOT NULL,
	`target_travel_date` text,
	`special_requirements` text,
	`status` text DEFAULT 'open' NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`office_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `job_orders_office_idx` ON `job_orders` (`office_id`);--> statement-breakpoint
CREATE INDEX `job_orders_status_idx` ON `job_orders` (`status`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`sender_user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_thread_idx` ON `messages` (`thread_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_org_idx` ON `notifications` (`org_id`);--> statement-breakpoint
CREATE TABLE `okb_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`placement_id` text NOT NULL,
	`airline` text NOT NULL,
	`flight_no` text,
	`pnr` text,
	`travel_date` text,
	`route` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`placement_id`) REFERENCES `placements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `okb_requests_placement_idx` ON `okb_requests` (`placement_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`country` text NOT NULL,
	`city` text,
	`license_number` text,
	`license_doc_key` text,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	`rejection_reason` text,
	`verified_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `placements` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`job_order_id` text NOT NULL,
	`office_id` text NOT NULL,
	`agency_id` text NOT NULL,
	`stage` text DEFAULT 'contract' NOT NULL,
	`stage_updated_at` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_order_id`) REFERENCES `job_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`office_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agency_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `placements_worker_idx` ON `placements` (`worker_id`);--> statement-breakpoint
CREATE INDEX `placements_office_idx` ON `placements` (`office_id`);--> statement-breakpoint
CREATE INDEX `placements_agency_idx` ON `placements` (`agency_id`);--> statement-breakpoint
CREATE TABLE `proposal_workers` (
	`proposal_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	PRIMARY KEY(`proposal_id`, `worker_id`),
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `proposal_workers_worker_idx` ON `proposal_workers` (`worker_id`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`job_order_id` text NOT NULL,
	`agency_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_order_id`) REFERENCES `job_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agency_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `proposals_job_order_idx` ON `proposals` (`job_order_id`);--> statement-breakpoint
CREATE INDEX `proposals_agency_idx` ON `proposals` (`agency_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `proposals_job_agency_idx` ON `proposals` (`job_order_id`,`agency_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_idx` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text,
	`placement_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`placement_id`) REFERENCES `placements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `threads_proposal_idx` ON `threads` (`proposal_id`);--> statement-breakpoint
CREATE INDEX `threads_placement_idx` ON `threads` (`placement_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_org_idx` ON `users` (`org_id`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workers` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`full_name` text NOT NULL,
	`dob` text,
	`nationality` text NOT NULL,
	`passport_no` text,
	`passport_expiry` text,
	`position` text NOT NULL,
	`experience_years` integer DEFAULT 0 NOT NULL,
	`languages` text DEFAULT '[]' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`salary_expectation` real,
	`photo_key` text,
	`video_key` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`consent_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consent_id`) REFERENCES `consents`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "workers_consent_required" CHECK("workers"."status" = 'draft' OR "workers"."consent_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `workers_agency_idx` ON `workers` (`agency_id`);--> statement-breakpoint
CREATE INDEX `workers_status_idx` ON `workers` (`status`);