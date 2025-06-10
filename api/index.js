const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // Gets key from Vercel
const app = express();

app.use(cors());
app.use(express.json());

// The endpoint our app will call
app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).send({ error: "Amount is required." });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });
    res.status(200).send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

module.exports = app;