CREATE TABLE `cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`config` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort` text NOT NULL,
	`kind` text NOT NULL,
	`identity` text NOT NULL,
	`data` text NOT NULL,
	`token` text,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `record_identity` ON `records` (`cohort`,`kind`,`identity`);