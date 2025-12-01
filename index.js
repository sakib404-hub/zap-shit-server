const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
