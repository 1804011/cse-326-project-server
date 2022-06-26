console.clear();
var request = require("request");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createSubmission, getSubmission } = require("./judge0");
const express = require("express");
const cors = require("cors");
const { compareOutput } = require("./checkVerdict");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(express.json());
app.use(cors());

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const usersCollection = client.db("cse326").collection("users");

    app.put("/users", async (req, res) => {
      const filter = { email: req?.body?.email };
      const updateDoc = {
        $set: {
          email: req?.body?.email,
          handle: req?.body?.handle,
        },
      };
      const options = { upsert: true };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      res.send(result);
    });
    app.put("/users/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

      const updateDoc = {
        $set: {
          role: role,
        },
      };

      const result = await usersCollection.updateOne(
        { _id: ObjectId(id) },
        updateDoc
      );
      //console.log(result);
      res.send(result);
    });
    app.get("/users", async (req, res) => {
      const usersCollection = client.db("cse326").collection("users");
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/:handle", async (req, res) => {
      const { handle } = req?.params;
      const result = await usersCollection.findOne({ handle });
      //console.log(result);
      res.send(result);
    });
    app.post("/contests", async (req, res) => {
      //console.log(req?.body);
      const contestsCollection = client.db("cse326").collection("contests");
      const result = await contestsCollection.insertOne(req?.body);
      //console.log(result);
      res.send(result);
    });
    app.get("/contests", async (req, res) => {
      const contestsCollection = client.db("cse326").collection("contests");
      const result = await contestsCollection.find({ ...req?.query }).toArray();
      result.sort((a, b) => b.startTime - a.startTime);
      //console.log(result);
      res.send(result);
    });
    app.get("/contests/:email", async (req, res) => {
      const { email } = req?.params;
      const contestsCollection = client.db("cse326").collection("contests");
      const result = await contestsCollection.find({ email }).toArray();
      //console.log(result);
      res.send(result);
    });

    app.delete("/contests/:id", async (req, res) => {
      const { id } = req?.params;
      const contestsCollection = client.db("cse326").collection("contests");
      const result = await contestsCollection.deleteOne({ _id: ObjectId(id) });
      //console.log(result);
      res.send(result);
    });
    app.put("/contests/:id", async (req, res) => {
      const { id } = req?.params;
      const { status } = req?.body;
      const contestsCollection = client.db("cse326").collection("contests");
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          status,
        },
      };
      const result = await contestsCollection.updateOne(filter, updateDoc);
      //console.log(result);
      res.send(result);
    });
    app.put(
      "/contests/:id/submit",
      createSubmission,
      getSubmission,
      async (req, res) => {
        // console.log(req?.body?.result?.submissions, req?.body?.output);
        req.body.verdict = compareOutput(
          req?.body?.result?.submissions,
          req?.body?.output
        );
        const { id } = req.params;
        const submissionCollection = client.db("cse326").collection("contests");
        const filter = { id };
        const updateDocs = {
          $push: {
            submissions: [req?.body?.handle].req?.body,
          },
        };
        const result = await submissionCollection.updateOne(filter, updateDocs);
        console.log(result);
        res.send({ result: req?.body });

        // console.log(result);

        //res.send({ result: req?.body });
      }
    );
    app.get("/contests/:id/my", async (req, res) => {
      const { id } = req.params;
      const { email } = req?.headers;
      const submissionCollection = client.db("cse326").collection("submission");
      const result = await submissionCollection
        .find({ id: parseInt(id), email })
        .toArray();
      result.sort((a, b) => b.submissionTime - a.submissionTime);
      //console.log(result);
      res.send(result);
    });
    app.get("/contests/:id/submissions", async (req, res) => {
      const { id } = req.params;
      const { time, duration } = req?.headers;
      const submissionCollection = client.db("cse326").collection("submission");

      console.log(time, duration);
      const result = await submissionCollection
        .find({
          id: parseInt(id),
        })
        .toArray();
      console.dir(result);
      const data = result.filter((a) => a.submissionTime - time <= duration);
      console.dir(data);
      res.send(data);
    });
  } finally {
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("welcome to our server");
});
app.listen(port, () => {
  console.log("listening to port", port);
});