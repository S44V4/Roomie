import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import householdsRouter from "./households";
import choresRouter from "./chores";
import assignmentsRouter from "./assignments";
import expensesRouter from "./expenses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(householdsRouter);
router.use(choresRouter);
router.use(assignmentsRouter);
router.use(expensesRouter);

export default router;
