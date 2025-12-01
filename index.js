const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(`${process.env.STRIPE_SECRET}`);
const port = process.env.PORT || 5015;

// middleware
app.use(express.json());
app.use(cors());

// mongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@crud-operation.iftbw43.mongodb.net/?appName=CRUD-operation`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const run = async () => {
  try {
    await client.connect();
    //here i will generate the apis
    const db = client.db("zap-shift-db");
    const percelsCollection = db.collection("percels");

    //percel apis
    app.get("/percels", async (req, res) => {
      // here i will do something
      const query = {};
      const cursor = percelsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    //getting mypercels only
    app.get("/myPercels", async (req, res) => {
      const query = {};
      //   const email = req.query.email;
      const { email } = req.query;
      if (email) {
        query.senderEmail = email;
      }
      const cursor = percelsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    //posting the informations
    app.post("/percels", async (req, res) => {
      const newPercel = req.body;
      newPercel.createdAt = new Date();
      const result = await percelsCollection.insertOne(newPercel);
      res.send(result);
    });
    // getting particular information
    app.get("/percels/:parcelId", async (req, res) => {
      const id = req.params.parcelId;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await percelsCollection.findOne(query);
      res.send(result);
    });
    // deletion of a percel
    app.delete("/percels/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await percelsCollection.deleteOne(query);
      res.send(result);
    });

    //Payment related apis
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              unit_amount: amount,
              currency: "USD",
              product_data: {
                name: paymentInfo.percelName,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: paymentInfo.senderEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
        metadata: {
          percelId: paymentInfo.percelId,
        },
      });
      res.send({ url: session.url });
    });

    // another way of doing it
    app.post("/payment-checkout-sesssion", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              unit_amount: amount,
              currency: "USD",
              product_data: {
                name: `Please Pay for ${paymentInfo.percelName}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          percelId: paymentInfo.percelId,
        },
        customer_email: paymentInfo.senderEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });
      res.send({ url: session.url });
    });

    app.patch("/payment-success", (req, res) => {
      const sessionId = req.query.session_id;
      console.log(sessionId);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB is Connected Successfully!");
  } catch (error) {
    console.log(error);
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Zap is Shifting shifting!");
});

app.listen(port, () => {
  console.log("This server is listening from port number : ", port);
});
