CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE SCHEMA "prdforge";
--> statement-breakpoint
CREATE TABLE "prdforge"."approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"version" text NOT NULL,
	"reported_by" text NOT NULL,
	"doc_version" text NOT NULL,
	"pdf_ref" text,
	"ledger_hash" text NOT NULL,
	"overrides" text[] DEFAULT '{}' NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."audit_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid,
	"caller" text NOT NULL,
	"reported_by" text,
	"action" text NOT NULL,
	"refs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tokens" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."brief_fact" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"anchors" text[] NOT NULL,
	"confidence" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."bundle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"files" jsonb NOT NULL,
	"verify" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."control" (
	"id" text PRIMARY KEY NOT NULL,
	"theme" text NOT NULL,
	"short_name" text NOT NULL,
	"summary" text NOT NULL,
	"triggers" text[] DEFAULT '{}' NOT NULL,
	"relevance" text NOT NULL,
	"pattern" text,
	"catalogue" text DEFAULT 'iso27001-2022-annex-a' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."control_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"req_id" text NOT NULL,
	"control_id" text NOT NULL,
	"strength" text NOT NULL,
	"rationale" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."control_status" (
	"run_id" uuid NOT NULL,
	"control_id" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	CONSTRAINT "control_status_run_id_control_id_pk" PRIMARY KEY("run_id","control_id")
);
--> statement-breakpoint
CREATE TABLE "prdforge"."decision" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"reported_by" text NOT NULL,
	"blocks" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."doc_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"doc_id" text NOT NULL,
	"doc_version" text,
	"content_hash" text NOT NULL,
	"direction" text NOT NULL,
	"blocks" jsonb NOT NULL,
	"rendered_hash" jsonb,
	"reconciled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."finding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"rule" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"suggested_fix" text,
	"status" text DEFAULT 'open' NOT NULL,
	"pass" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."open_question" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"question" text NOT NULL,
	"blocks" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"answer" text
);
--> statement-breakpoint
CREATE TABLE "prdforge"."prd_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product" text NOT NULL,
	"project_ref" text,
	"stage" text DEFAULT 'ingest' NOT NULL,
	"outcome" text,
	"digest" text,
	"glossary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile" jsonb,
	"budget" jsonb DEFAULT '{"caps":{"requirements":400,"toolCalls":2000,"repairPasses":18},"usage":{}}'::jsonb NOT NULL,
	"doc_id" text,
	"ledger_hash" text,
	"parent_run_id" uuid,
	"created_by" text NOT NULL,
	"caller" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."requirement" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"section_id" text NOT NULL,
	"type" text NOT NULL,
	"statement" text NOT NULL,
	"rationale" text NOT NULL,
	"source" jsonb NOT NULL,
	"priority" text NOT NULL,
	"verification" text NOT NULL,
	"stability" text DEFAULT 'tbd' NOT NULL,
	"stakeholders" text[] DEFAULT '{}' NOT NULL,
	"depends_on" text[] DEFAULT '{}' NOT NULL,
	"origin" text DEFAULT 'agent' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"acceptance" jsonb,
	"open_question_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"req_id" text NOT NULL,
	"revision" integer NOT NULL,
	"statement" text NOT NULL,
	"origin" text NOT NULL,
	"reported_by" text,
	"doc_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prdforge"."section" (
	"run_id" uuid NOT NULL,
	"id" text NOT NULL,
	"kind" text NOT NULL,
	"order" integer NOT NULL,
	"mandatory" boolean DEFAULT true NOT NULL,
	"title" text NOT NULL,
	"narrative" text,
	"summary" text,
	"content_hash" text,
	"status" text DEFAULT 'empty' NOT NULL,
	CONSTRAINT "section_run_id_id_pk" PRIMARY KEY("run_id","id")
);
--> statement-breakpoint
CREATE TABLE "prdforge"."source_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"upload_ref" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"role" text NOT NULL,
	"content_hash" text NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extraction" jsonb,
	"confidence" numeric
);
--> statement-breakpoint
CREATE TABLE "prdforge"."workflow_model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"flows" jsonb NOT NULL,
	"source_doc_ids" uuid[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prdforge"."approval" ADD CONSTRAINT "approval_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."brief_fact" ADD CONSTRAINT "brief_fact_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."bundle" ADD CONSTRAINT "bundle_approval_id_approval_id_fk" FOREIGN KEY ("approval_id") REFERENCES "prdforge"."approval"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."control_mapping" ADD CONSTRAINT "control_mapping_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."control_mapping" ADD CONSTRAINT "control_mapping_req_id_requirement_id_fk" FOREIGN KEY ("req_id") REFERENCES "prdforge"."requirement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."control_mapping" ADD CONSTRAINT "control_mapping_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "prdforge"."control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."control_status" ADD CONSTRAINT "control_status_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."control_status" ADD CONSTRAINT "control_status_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "prdforge"."control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."decision" ADD CONSTRAINT "decision_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."doc_snapshot" ADD CONSTRAINT "doc_snapshot_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."finding" ADD CONSTRAINT "finding_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."open_question" ADD CONSTRAINT "open_question_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."requirement" ADD CONSTRAINT "requirement_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."revision" ADD CONSTRAINT "revision_req_id_requirement_id_fk" FOREIGN KEY ("req_id") REFERENCES "prdforge"."requirement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."section" ADD CONSTRAINT "section_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."source_document" ADD CONSTRAINT "source_document_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prdforge"."workflow_model" ADD CONSTRAINT "workflow_model_run_id_prd_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "prdforge"."prd_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_run_per_product" ON "prdforge"."prd_run" USING btree ("product") WHERE "prdforge"."prd_run"."stage" <> 'done';--> statement-breakpoint
CREATE INDEX "requirement_run_section" ON "prdforge"."requirement" USING btree ("run_id","section_id");