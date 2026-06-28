import { Router } from "express";
import { db } from "../lib/sqlite";

const router = Router();

router.get("/reports/sales", (req, res) => {
  const { startDate, endDate, groupBy = "day" } = req.query;
  let format = "%Y-%m-%d";
  if (groupBy === "month") format = "%Y-%m";
  if (groupBy === "year") format = "%Y";

  let sql = `
    SELECT strftime(?, created_at) as period,
           COALESCE(SUM(total), 0) as total,
           COUNT(*) as orders,
           0 as profit
    FROM orders WHERE 1=1
  `;
  const params: any[] = [format];
  if (startDate) { sql += " AND DATE(created_at)>=?"; params.push(startDate); }
  if (endDate) { sql += " AND DATE(created_at)<=?"; params.push(endDate); }
  sql += " GROUP BY period ORDER BY period";

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

export default router;
