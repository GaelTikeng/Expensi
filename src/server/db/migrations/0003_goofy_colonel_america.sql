ALTER TABLE "expenses" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "location_label" varchar(200);