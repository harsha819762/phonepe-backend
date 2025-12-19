import express from "express";
import cors from "cors";
import crypto from "crypto";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
const PHONEPE_BASE_URL = "https://api.phonepe.com/apis/hermes";

app.post("/create-phonepe-payment", async (req, res) => {
  try {
    const { amount, userId } = req.body;
    if (!PHONEPE_MERCHANT_ID || !PHONEPE_SALT_KEY) {
      return res.status(400).json({ success: false, message: "Missing PhonePe credentials" });
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    const transactionId = "TXN_" + Date.now();
    const payload = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: transactionId,
      merchantUserId: userId || "USER001",
      amount: Math.round(amt * 100),
      redirectUrl: "https://haptags.com/payment-success",
      redirectMode: "POST",
      callbackUrl: "https://phonepe-backend.onrender.com/phonepe-callback",
      paymentInstrument: { type: "PAY_PAGE" },
    };
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
    const checksum =
      crypto.createHash("sha256").update(base64Payload + "/pg/v1/pay" + PHONEPE_SALT_KEY).digest("hex") +
      "###" +
      PHONEPE_SALT_INDEX;
    const response = await axios.post(
      `${PHONEPE_BASE_URL}/pg/v1/pay`,
      { request: base64Payload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum,
        },
      }
    );
    const url =
      response?.data?.data?.instrumentResponse?.redirectInfo?.url ||
      response?.data?.data?.redirectUrl ||
      null;
    if (!url) {
      return res.status(502).json({ success: false, message: "Invalid response from PhonePe" });
    }
    res.json({ success: true, paymentUrl: url, transactionId });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "PhonePe payment failed",
      error: error.message,
    });
  }
});

app.post("/phonepe-callback", (req, res) => {
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("PhonePe backend running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("PhonePe backend running on port", process.env.PORT || 3000);
});
