console.clear();
var request = require("request");
const { getNewRatings } = require("codeforces-rating-system");
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
      ////////////////////console.log(result);
      res.send(result);
    });

    app.get("/contests/:id", async (req, res) => {
      const { id } = req?.params;

      const contestsCollection = client.db("cse326").collection("contests");
      if (isNaN(parseInt(id))) {
        const result = await contestsCollection.find({ email: id }).toArray();
        result.sort((a, b) => b.startTime - a.startTime);
        res.send(result);
      } else {
        const result = await contestsCollection.findOne({ id });
        // result.sort((a, b) => b.startTime - a.startTime);
        res.send(result);
      }
    });
    app.post("/contests", async (req, res) => {
      ////////////////////console.log(req?.body);
      const { startTime, duration, id, problems } = req?.body;
      const date = new Date().getTime();

      const contestsCollection = client.db("cse326").collection("contests");
      const result = await contestsCollection.insertOne(req?.body);

      ////////////////////console.log(result);
      res.send(result);
      if (result?.acknowledged) {
        setTimeout(async () => {
          const submissionCollection = client
            .db("cse326")
            .collection("submission");

          const submissions = await submissionCollection
            .aggregate([
              {
                $match: {
                  id: {
                    $in: [parseInt(id)],
                  },
                  submissionTime: {
                    $gte: parseInt(startTime),
                    $lte: parseInt(startTime) + parseInt(duration),
                  },
                },
              },
              {
                $sort: {
                  submissionTime: -1,
                },
              },
              {
                $group: {
                  _id: {
                    handle: "$handle",
                  },
                  submissions: {
                    $addToSet: {
                      source_code: "$source_code",
                      problem: "$problem",
                      submissionTime: "$submissionTime",
                      mark: "$mark",
                      verdict: "$verdict",
                    },
                  },
                },
              },
            ])
            .toArray();
          let sz = submissions.length;
          for (let i = 0; i < sz; i++) {
            const handle = submissions[i]._id.handle;
            let marks = 0;
            let accepted = [];
            let ok = 0;
            let tried = [-1, -1, -1];
            let ttl = submissions[i].submissions.length;
            let visit = [-1, -1, -1];
            submissions[i].submissions.sort(
              (a, b) => b.submissionTime - a.submissionTime
            );
            for (let j = 0; j < ttl; j++) {
              let submission = submissions[i].submissions[j];
              if (submission.verdict == "Accepted") {
                let k = submission.problem;
                if (visit[k] == -1) {
                  accepted[k] = {
                    problem: k,
                    submissionTime: submission.submissionTime,
                    mark: submission.mark,
                  };
                  ok++;
                  marks += parseInt(submission.mark);
                  visit[k] = 1;
                }
              } else {
                let k = submission.problem;
                if (visit[k] == -1) {
                  tried[k] = k;
                }
                visit[k] = 1;
              }
            }

            marks = marks - 10 * (ttl - accepted.length);
            submissions[i].score = marks;
            if (submissions[i].score < 0) {
              submissions[i].score = 0;
            }
            submissions[i].accepted = accepted;
            submissions[i].penalty = 10 * (ttl - accepted.length);
            submissions[i].handle = handle;
            submissions[i].tried = tried;
            submissions[i].ok = ok;
          }
          submissions.sort((a, b) => b.score - a.score);
          const contestants = [];

          for (let i = 0; i < submissions.length; i++) {
            let contestant = {};
            contestant.username = submissions[i].handle;
            contestant.position = i + 1;
            const rating = await client
              .db("cse326")
              .collection("ratings")
              .findOne({ handle: contestant.username });

            contestant.previousRating = rating?.rating || 200;
            contestants.push(contestant);
          }
          let newRating = getNewRatings(contestants);
          await client
            .db("cse326")
            .collection("contests")
            .updateOne(
              { identity: parseInt(id) },
              {
                $set: {
                  standing: submissions,
                  newRating,
                },
              }
            );
          for (let i = 0; i < newRating.length; i++) {
            const contestant = newRating[i];
            const ratingCollection = client.db("cse326").collection("ratings");
            await ratingCollection.updateOne(
              { handle: contestant?.username },
              {
                $set: {
                  rating: parseInt(contestant.newRating),
                },
              },
              {
                upsert: true,
              }
            );
          }
          let problemsSize = problems.length;
          console.log(problems);
          let data = [];
          for (let i = 0; i < problemsSize; i++) {
            const obj = {};
            obj.id = id + "-" + String.fromCharCode(i + 65);
            obj.title = problems[i].title;
            obj.rating = problems[i].rating;
            data.push(obj);
          }

          let insertionResult = await client
            .db("cse326")
            .collection("problemsets")
            .insertMany(data);
          console.log(insertionResult);
        }, startTime + duration + 10000 - date);
      }
    });
    app.get("/contests", async (req, res) => {
      const contestsCollection = client.db("cse326").collection("contests");
      const result = await contestsCollection
        .find({
          status: {
            $nin: ["pending", "discarded"],
            $in: ["published", req?.query?.requested],
          },
        })
        .toArray();
      result.sort((a, b) => b.startTime - a.startTime);

      res.send(result);
    });

    app.delete("/contests/:id", async (req, res) => {
      const { id } = req?.params;

      const contestsCollection = client.db("cse326").collection("contests");
      const result = await contestsCollection.deleteOne({ _id: ObjectId(id) });
      ////////////////////console.log(result);
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
      ////////////////////console.log(result);
      res.send(result);
    });
    app.post(
      "/contests/:id/submit",
      createSubmission,
      getSubmission,
      async (req, res) => {
        //////////////////////console.log(req?.body?.result?.submissions, req?.body?.output);
        req.body.verdict = compareOutput(
          req?.body?.result?.submissions,
          req?.body?.output
        );

        const { id } = req.params;
        const submissionCollection = client
          .db("cse326")
          .collection("submission");
        const result = await submissionCollection.insertOne({
          ...req?.body,
          id: parseInt(id),
        });
        // ////////////////console.log(req.body);
        res.send(result);
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
      //////////////////console.log(result);
      res.send(result);
    });
    app.get("/contests/:id/submissions", async (req, res) => {
      const { id } = req.params;
      const { time, duration } = req?.headers;
      const submissionCollection = client.db("cse326").collection("submission");

      ////////////////////console.log(time, duration);
      const result = await submissionCollection
        .find({
          id: parseInt(id),
        })
        .toArray();
      // console.dir(result);
      const data = result.filter((a) => a.submissionTime - time <= duration);
      // console.dir(data);
      res.send(data);
    });
    app.post("/role", async (req, res) => {
      const { email, handle } = req?.body;
      const roleRequestCollection = client.db("cse326").collection("role");
      const result = await roleRequestCollection.insertOne({ email, handle });
      ////////////////////console.log(result);
      res.send(result);
    });
    app.get("/role", async (req, res) => {
      const roleRequestCollection = client.db("cse326").collection("role");
      const result = await roleRequestCollection.find().toArray();
      ////////////////////console.log(result);
      res.send(result);
    });
    app.get("/submissions", async (req, res) => {
      const { id, starttime, duration } = req.headers;
      // ////////////////console.log(id, starttime, duration);
      const submissionCollection = client.db("cse326").collection("submission");

      const result = await submissionCollection
        .aggregate([
          {
            $match: {
              id: {
                $in: [parseInt(id)],
              },
              submissionTime: {
                $gte: parseInt(starttime),
                $lte: parseInt(starttime) + parseInt(duration),
              },
            },
          },
          {
            $sort: {
              submissionTime: -1,
            },
          },
          {
            $group: {
              _id: {
                handle: "$handle",
              },
              submissions: {
                $addToSet: {
                  source_code: "$source_code",
                  problem: "$problem",
                  submissionTime: "$submissionTime",
                  mark: "$mark",
                  verdict: "$verdict",
                },
              },
            },
          },
        ])
        .toArray();

      //////////////////console.log(result);
      res.send(result);
    });
    app.get("/ratings/:handle", async (req, res) => {
      const { handle } = req?.params;
      ////////////////console.log(handle);
      const ratingCollection = client.db("cse326").collection("ratings");
      const rating = await ratingCollection.findOne({ handle });
      ////////////////console.log(rating);
      res.send(rating);
    });
    app.put("/users/social/:email", async (req, res) => {
      const { email } = req?.params;
      const usersCollection = client.db("cse326").collection("users");
      const filter = { email };
      const updateDoc = {
        $set: {
          ...req?.body,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      ////////////////console.log(result);
      res.send(result);
    });
    app.get("/profile/:email", async (req, res) => {
      const { email } = req?.params;
      const usersCollection = client.db("cse326").collection("users");
      const result = await usersCollection.findOne({ email });
      ////////////////console.log(result);
      res.send(result);
    });
    app.get("/submissions/:handle", async (req, res) => {
      const { handle } = req?.params;
      const submissionCollection = client.db("cse326").collection("submission");
      const result = await submissionCollection.find({ handle }).toArray();
      result.sort((a, b) => b.submissionTime - a.submissionTime);
      res.send(result);
    });
    app.get("/profile/contests/:handle", async (req, res) => {
      const { handle } = req?.params;
      const contestsCollection = client.db("cse326").collection("contests");
      const result = await contestsCollection
        .find({
          standing: {
            $elemMatch: {
              handle,
            },
          },
        })
        .toArray();
      result.sort((a, b) => b.startTime - a.startTime);
      res.send(result);
    });
    app.get("/problemsets", async (req, res) => {
      const result = await client
        .db("cse326")
        .collection("problemsets")
        .find({})
        .toArray();
      // console.log(result);
      res.send(result);
    });
    app.post("/dashboard/add-problem", async (req, res) => {
      const data = req?.body;
      const result = await client
        .db("cse326")
        .collection("offline-problems")
        .insertOne(data);
      console.log(result);
      res.send(result);
    });
    app.get("/offline/:email", async (req, res) => {
      const { email } = req?.params;
      const result = await client
        .db("cse326")
        .collection("offline-problems")
        .find({ email })
        .toArray();
      res.send(result.reverse());
    });
    app.put("/offline/problems/:id", async (req, res) => {
      const { id } = req?.params;
      const problemsCollection = client
        .db("cse326")
        .collection("offline-problems");
      const updateDoc = {
        $set: {
          ...req?.body,
        },
      };
      const result = await problemsCollection.updateOne(
        { _id: ObjectId(id) },
        updateDoc
      );
      ////////////////console.log(result);
      res.send(result);
    });
    app.delete("/offline/problem/:id", async (req, res) => {
      const { id } = req?.params;
      const problemsCollection = client
        .db("cse326")
        .collection("offline-problems");
      const result = await problemsCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });
    app.get("/offline-problems", async (req, res) => {
      const result = await client
        .db("cse326")
        .collection("offline-problems")
        .find({
          status: {
            $nin: ["pending"],
          },
        })
        .toArray();
      res.send(result.reverse());
    });
    app.put("/offline-problems/:id", async (req, res) => {
      const { id } = req?.params;
      const problemsCollection = client
        .db("cse326")
        .collection("offline-problems");
      const updateDoc = {
        $set: {
          ...req?.body,
        },
      };
      const result = await problemsCollection.updateOne(
        { _id: ObjectId(id) },
        updateDoc
      );
      ////////////////console.log(result);
      res.send(result);
    });
    app.get("/problemsets/offline", async (req, res) => {
      const result = await client
        .db("cse326")
        .collection("offline-problems")
        .find({ status: "published" })
        .toArray();
      res.send(result.reverse());
    });
    app.get("/offline-problems/:id", async (req, res) => {
      const { id } = req?.params;
      const result = await client
        .db("cse326")
        .collection("offline-problems")
        .findOne({ _id: ObjectId(id) });
      res.send(result);
    });
    app.post(
      "/offline-problems/:id/submit",
      createSubmission,
      getSubmission,
      async (req, res) => {
        req.body.verdict = compareOutput(
          req?.body?.result?.submissions,
          req?.body?.output
        );

        const { id } = req.params;
        const submissionCollection = client
          .db("cse326")
          .collection("submission");
        const result = await submissionCollection.insertOne({
          ...req?.body,
          id: parseInt(id),
        });
        // ////////////////console.log(req.body);
        res.send(result);
      }
    );
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
