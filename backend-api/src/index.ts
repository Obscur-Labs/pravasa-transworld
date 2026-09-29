import "dotenv/config";
import app from "./app";
import { connectDB } from "./config/database";
import { initCloudinary } from "./config/cloudinary";
import { verifyMailConnection } from "./config/email";

import { assertEnv } from "./config/env";

import http from "http";
import { initSocket } from "./utils/socket";
import { startPaymentReminderLoop } from "./services/paymentAlerts.service";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

(async () => {
  try {
    assertEnv();
    await connectDB();
    initCloudinary();
    await verifyMailConnection();
    server.listen(PORT, () => {
      console.log(`Pravasa Transworld API running on http://localhost:${PORT}`);
    });
    startPaymentReminderLoop();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
