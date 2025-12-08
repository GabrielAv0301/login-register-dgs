import { column, defineDb, defineTable, sql } from "astro:db";

export const Users = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    email: column.text({ unique: true }),
    passwordHash: column.text(),
    createdAt: column.date({ default: sql`CURRENT_TIMESTAMP` }),
  },
});

export const Sessions = defineTable({
  columns: {
    tokenHash: column.text({ primaryKey: true }),
    userId: column.text({ references: () => Users.columns.id }),
    expiresAt: column.date(),
    createdAt: column.date({ default: sql`CURRENT_TIMESTAMP` }),
  },
});

export default defineDb({
  tables: { Users, Sessions },
});
