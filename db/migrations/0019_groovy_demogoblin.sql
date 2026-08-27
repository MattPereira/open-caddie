CREATE TABLE "pairing_members" (
	"tournament_id" integer NOT NULL,
	"pairing_id" integer NOT NULL,
	"round_id" integer NOT NULL,
	CONSTRAINT "pairing_members_pairing_id_round_id_pk" PRIMARY KEY("pairing_id","round_id")
);
--> statement-breakpoint
CREATE TABLE "pairings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pairings_id_tournament_unique" ON "pairings" USING btree ("id","tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_id_tournament_unique" ON "rounds" USING btree ("id","tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pairing_members_round_unique" ON "pairing_members" USING btree ("round_id");--> statement-breakpoint
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_members" ADD CONSTRAINT "pairing_members_pairing_tournament_fk" FOREIGN KEY ("pairing_id","tournament_id") REFERENCES "public"."pairings"("id","tournament_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_members" ADD CONSTRAINT "pairing_members_round_tournament_fk" FOREIGN KEY ("round_id","tournament_id") REFERENCES "public"."rounds"("id","tournament_id") ON DELETE cascade ON UPDATE no action;
