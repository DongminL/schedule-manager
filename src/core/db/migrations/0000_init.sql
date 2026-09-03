CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(50) NOT NULL,
	"role" varchar(10) DEFAULT 'STAFF' NOT NULL,
	"color" varchar(7) DEFAULT '#cccccc' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "default_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"day_of_week" varchar(3) NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "updated_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"default_schedule_id" integer,
	"kind" varchar(10) NOT NULL,
	"update_date" date NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_change_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"approve_by" integer,
	"type" varchar(12) NOT NULL,
	"update_date" date NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"target_default_schedule_id" integer,
	"target_updated_schedule_id" integer,
	"reason" varchar(500) NOT NULL,
	"reject_reason" varchar(500),
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"peer_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swap_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_change_request_id" integer NOT NULL,
	"peer_user_id" integer NOT NULL,
	"swap_date" date NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"peer_target_default_schedule_id" integer,
	"peer_target_updated_schedule_id" integer
);
--> statement-breakpoint
CREATE TABLE "substitute_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_change_request_id" integer NOT NULL,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_adjustment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_change_request_id" integer NOT NULL,
	"adjust_start_at" timestamp with time zone NOT NULL,
	"adjust_end_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "default_schedule" ADD CONSTRAINT "default_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "updated_schedule" ADD CONSTRAINT "updated_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "updated_schedule" ADD CONSTRAINT "updated_schedule_default_schedule_id_default_schedule_id_fk" FOREIGN KEY ("default_schedule_id") REFERENCES "public"."default_schedule"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_approve_by_users_id_fk" FOREIGN KEY ("approve_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_target_default_schedule_id_default_schedule_id_fk" FOREIGN KEY ("target_default_schedule_id") REFERENCES "public"."default_schedule"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_target_updated_schedule_id_updated_schedule_id_fk" FOREIGN KEY ("target_updated_schedule_id") REFERENCES "public"."updated_schedule"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_schedule_change_request_id_schedule_change_requests_id_fk" FOREIGN KEY ("schedule_change_request_id") REFERENCES "public"."schedule_change_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_peer_user_id_users_id_fk" FOREIGN KEY ("peer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_peer_target_default_schedule_id_default_schedule_id_fk" FOREIGN KEY ("peer_target_default_schedule_id") REFERENCES "public"."default_schedule"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_peer_target_updated_schedule_id_updated_schedule_id_fk" FOREIGN KEY ("peer_target_updated_schedule_id") REFERENCES "public"."updated_schedule"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "substitute_requests" ADD CONSTRAINT "substitute_requests_schedule_change_request_id_schedule_change_requests_id_fk" FOREIGN KEY ("schedule_change_request_id") REFERENCES "public"."schedule_change_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "substitute_requests" ADD CONSTRAINT "substitute_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "time_adjustment_requests" ADD CONSTRAINT "time_adjustment_requests_schedule_change_request_id_schedule_change_requests_id_fk" FOREIGN KEY ("schedule_change_request_id") REFERENCES "public"."schedule_change_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_phone_number" ON "users" USING btree ("phone_number");
--> statement-breakpoint
CREATE INDEX "idx_default_schedule_user_dow" ON "default_schedule" USING btree ("user_id","day_of_week");
--> statement-breakpoint
CREATE INDEX "idx_default_schedule_window" ON "default_schedule" USING btree ("start_date","end_date");
--> statement-breakpoint
CREATE INDEX "idx_updated_schedule_user_date" ON "updated_schedule" USING btree ("user_id","update_date");
--> statement-breakpoint
CREATE INDEX "idx_updated_schedule_date" ON "updated_schedule" USING btree ("update_date");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_updated_schedule_occurrence" ON "updated_schedule" USING btree ("default_schedule_id","update_date") WHERE "updated_schedule"."deleted_at" is null and "updated_schedule"."default_schedule_id" is not null;
--> statement-breakpoint
CREATE INDEX "idx_scr_status" ON "schedule_change_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_scr_user" ON "schedule_change_requests" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_scr_update_date" ON "schedule_change_requests" USING btree ("update_date");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_scr_pending_default_target" ON "schedule_change_requests" USING btree ("user_id","update_date","target_default_schedule_id") WHERE "schedule_change_requests"."status" in ('PENDING','WAITING_PEER_ACCEPT') and "schedule_change_requests"."deleted_at" is null and "schedule_change_requests"."target_default_schedule_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_scr_pending_updated_target" ON "schedule_change_requests" USING btree ("user_id","target_updated_schedule_id") WHERE "schedule_change_requests"."status" in ('PENDING','WAITING_PEER_ACCEPT') and "schedule_change_requests"."deleted_at" is null and "schedule_change_requests"."target_updated_schedule_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_swap_requests_parent" ON "swap_requests" USING btree ("schedule_change_request_id");
--> statement-breakpoint
CREATE INDEX "idx_swap_requests_peer" ON "swap_requests" USING btree ("peer_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_substitute_requests_parent" ON "substitute_requests" USING btree ("schedule_change_request_id");
--> statement-breakpoint
CREATE INDEX "idx_substitute_requests_user" ON "substitute_requests" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_time_adjustment_requests_parent" ON "time_adjustment_requests" USING btree ("schedule_change_request_id");
