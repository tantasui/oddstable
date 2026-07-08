CREATE TABLE `contest_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`fixture_id` text NOT NULL,
	`market` text DEFAULT '1X2' NOT NULL,
	`odds_1_bp` integer NOT NULL,
	`odds_x_bp` integer NOT NULL,
	`odds_2_bp` integer NOT NULL,
	`result` text,
	FOREIGN KEY (`contest_id`) REFERENCES `contests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`creator_id` text NOT NULL,
	`mode` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`starts_at` integer NOT NULL,
	`prize_pool` integer DEFAULT 0 NOT NULL,
	`max_entries` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`user_id` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`anonymous` integer DEFAULT false NOT NULL,
	`oddscore_raw` text DEFAULT '0' NOT NULL,
	`winning_count` integer DEFAULT 0 NOT NULL,
	`final_rank` integer,
	FOREIGN KEY (`contest_id`) REFERENCES `contests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`round` text NOT NULL,
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`kickoff` integer NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`home_goals` integer DEFAULT 0 NOT NULL,
	`away_goals` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `picks` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`contest_match_id` text NOT NULL,
	`selection` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contest_match_id`) REFERENCES `contest_matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `score_log` (
	`id` text PRIMARY KEY NOT NULL,
	`fixture_id` text NOT NULL,
	`home_goals` integer NOT NULL,
	`away_goals` integer NOT NULL,
	`minute` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);