CREATE TABLE `taxa` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`path_key` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxa_owner_path` ON `taxa` (`owner`,`path_key`);