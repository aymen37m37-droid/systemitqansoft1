import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import ordersRouter from "./orders";
import customersRouter from "./customers";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(customersRouter);
router.use(usersRouter);
router.use(dashboardRouter);
router.use(settingsRouter);
router.use(reportsRouter);

export default router;
