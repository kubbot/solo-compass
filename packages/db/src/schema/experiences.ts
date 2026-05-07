import {
  pgTable,
  text,
  real,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const experiences = pgTable("experiences", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  longitude: real("longitude").notNull(),
  latitude: real("latitude").notNull(),
  bestTimes: jsonb("best_times").notNull().default([]),
  soloScore: integer("solo_score").notNull().default(0),
  confidence: text("confidence").notNull().default("low"),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
