CREATE TABLE `gym_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`document_json` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	CONSTRAINT "gym_drafts_archived" CHECK("gym_drafts"."archived" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `gym_drafts_listing` ON `gym_drafts` (`archived`,"updated_at" DESC,`id`);--> statement-breakpoint
CREATE TABLE `gym_imports` (
	`request_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gym_publications` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`source_draft_id` text,
	`source_revision` integer,
	`restored_from` text,
	`previous_id` text,
	`document_json` text NOT NULL,
	`public_json` text NOT NULL,
	`published_at` text NOT NULL,
	`published_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gym_publications_id_unique` ON `gym_publications` (`id`);--> statement-breakpoint
CREATE TABLE `gym_staff` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "gym_staff_role" CHECK("gym_staff"."role" IN ('editor','publisher'))
);
