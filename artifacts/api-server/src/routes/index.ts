import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import meRouter from "./me";
import clansRouter from "./clans";
import membersRouter from "./members";
import joinRequestsRouter from "./joinRequests";
import inviteRouter from "./invite";
import discordRouter from "./discord";
import alertsRouter from "./alerts";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(meRouter);
router.use(clansRouter);
router.use(membersRouter);
router.use(joinRequestsRouter);
router.use(inviteRouter);
router.use(discordRouter);
router.use(alertsRouter);
router.use(pushRouter);

export default router;
