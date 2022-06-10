console.clear();
const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wf9uh.mongodb.net/?retryWrites=true&w=majority`;
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
    app.get("/users/:handle", async (req, res) => {
      const { handle } = req?.params;
      const result = await usersCollection.findOne({ handle });
      res.send(result);
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
