import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  customType,
} from "drizzle-orm/pg-core";

export const experienceStatusEnum = pgEnum("experience_status", [
  "candidate",
  "active",
  "stale",
  "retired",
]);

// PostGIS geography(Point,4326) stored as WKB hex; returned as WKB text from the DB.
const geography = customType<{ data: string }>({
  dataType() {
    return "geography(Point,4326)";
  },
});

export const experiences = pgTable("experiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  oneLiner: text("one_liner").notNull(),
  whyItMatters: text("why_it_matters").notNull(),
  category: text("category").notNull(),
  // geography(Point,4326) — [longitude, latitude] per GeoJSON convention
  location: geography("location").notNull(),
  confidenceLevel: integer("confidence_level").notNull().default(0),
  status: experienceStatusEnum("status").notNull().default("candidate"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastCompiledAt: timestamp("last_compiled_at", { withTimezone: true }),
});
