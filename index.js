const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(`${process.env.STRIPE_SECRET}`);
const port = process.env.PORT || 5015;
// initializing firebase Admin
const admin = require("firebase-admin");
const serviceAccount = require("./admin_key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const generateTrackingId = () => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ZAP-${date}-${random}`;
};

// middleware
app.use(express.json());
app.use(cors());

const verifyFirebaseToken = async (req, res, next) => {
  // console.log("header : ", req.headers.authorization);
  const accessToken = req.headers.authorization;
  if (!accessToken) {
    return res.status(401).send({ message: "Unauthorized Access!" });
  }
  try {
    const tokenId = accessToken.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(tokenId);
    // console.log("Decoed in the token : ", decoded);
    req.tokenEmail = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "UnAuthorized Access!" });
  }
};

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
    const usersCollection = db.collection("users");
    const percelsCollection = db.collection("percels");
    const paymentCollection = db.collection("payments");
    const ridersCollection = db.collection("riders");

    // middleWare with the database Access
    //verifyAdmin before allowing the admin activity
    //must be used after verifying the firebaseToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.tokenEmail;
      const query = {
        email: email,
      };
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden Accesss!" });
      }
      next();
    };
    // user related apis
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      newUser.role = "user";
      const email = newUser.email;
      const userExits = await usersCollection.findOne({ email });
      if (userExits) {
        return res.send({ message: "User Exist!" });
      }
      newUser.createdAt = new Date();
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const searchText = req.query.searchText;
      const query = {};
      // if (searchText) {
      //   query.displayName = {
      //     $regex: searchText,
      //     $options: "i",
      //   };
      // }
      if (searchText) {
        query.$or = [
          { diplayName: { $regex: searchText, $options: "i" } },
          { email: { $regex: searchText, $options: "i" } },
        ];
      }
      const cursor = usersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    app.patch(
      "/users/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const updateInfo = req.body;
        const query = {
          _id: new ObjectId(id),
        };
        const updatedDoc = {
          $set: {
            role: updateInfo.role,
          },
        };
        const result = await usersCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );

    //riders related apis
    app.post("/riders", async (req, res) => {
      const newRider = req.body;
      newRider.status = "pending";
      newRider.createdAt = new Date();

      const result = await ridersCollection.insertOne(newRider);
      res.send(result);
    });

    app.get("/riders", async (req, res) => {
      const { status, district, workStatus } = req.query;
      const query = {};
      if (status) {
        query.status = req.query.status;
      }
      // if (district) {
      //   query.ridersDistrict = district;
      // }
      if (workStatus) {
        query.workStatus = workStatus;
      }
      const cursor = ridersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.patch(
      "/riders/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const status = req.body.status;
        const updatedDoc = {
          $set: {
            status: status,
            workStatus: "available",
          },
        };
        const query = {
          _id: new ObjectId(id),
        };
        const result = await ridersCollection.updateOne(query, updatedDoc);
        if (status === "approved") {
          const email = req.body.email;
          const userQuery = { email: email };
          const updateUser = {
            $set: {
              role: "rider",
              workStatus: "available",
            },
          };
          const userResult = await usersCollection.updateOne(
            userQuery,
            updateUser
          );
        }
        res.send(result);
      }
    );

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
      const { email, deliveryStatus } = req.query;
      if (email) {
        query.senderEmail = email;
      }
      if (deliveryStatus) {
        query.deliveryStatus = deliveryStatus;
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
          percelName: paymentInfo.percelName,
        },
        customer_email: paymentInfo.senderEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });
      res.send({ url: session.url });
    });

    app.post("payment-checkout-session", async (req, res) => {
      const paymenInfo = req.body;
      const amount = parseFloat(paymenInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              unit_amount: amount,
              currency: "USD",
              product_data: {
                name: `Please Pay for ${paymenInfo.percelName}`,
              },
              quantity: 1,
            },
          },
        ],
        mode: "payment",
        metadata: {
          percelId: paymenInfo.percelId,
          percelName: paymenInfo.percelName,
        },
        customerEmail: paymenInfo.senderEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      // console.log("session retrive, ", session);
      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };

      const paymentExist = await paymentCollection.findOne(query);
      if (paymentExist) {
        const query = {
          _id: new ObjectId(paymentExist.parcelId),
        };
        const parcel = await percelsCollection.findOne(query);
        return res.send({
          success: true,
          message: "Payment Already Exist!",
          transactionId: paymentExist.transactionId,
          trackingId: parcel.trackingId,
        });
      }

      if (session.payment_status === "paid") {
        const id = session.metadata.percelId;
        const query = {
          _id: new ObjectId(id),
        };
        const trackingId = generateTrackingId();
        const update = {
          $set: {
            paymentStatus: "paid",
            trackingId: trackingId,
            deliveryStatus: "pending-pickup",
          },
        };
        const result = await percelsCollection.updateOne(query, update);

        //getting a payment entries
        const payment = {
          transactionId: session.payment_intent,
          amount: session.amount_total / 100,
          name: session.metadata.percelName,
          currency: session.currency,
          customerEmail: session.customer_email,
          parcelId: session.metadata.percelId,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
        };
        if (session.payment_status === "paid") {
          const resultPayment = await paymentCollection.insertOne(payment);
          return res.send({
            success: true,
            modifyPercel: result,
            paymenInfo: resultPayment,
            transactionId: session.payment_intent,
            trackingId: trackingId,
          });
        }
      }
      res.send({ success: false });
    });

    app.get("/payments", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      const sortField = {
        paidAt: -1,
      };
      // console.log("headers : ", req.headers);
      if (email) {
        query.customerEmail = email;
        // checking email adress
        if (email !== req.tokenEmail) {
          return res.status(403).send({ messgae: "Forbidden Access!" });
        }
      }
      const cursor = paymentCollection.find(query).sort(sortField);
      const result = await cursor.toArray();
      res.send(result);
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
