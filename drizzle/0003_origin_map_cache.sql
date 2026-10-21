CREATE TABLE `map_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires` integer NOT NULL
);
