require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;
const app = express();

//middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.jq7qb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("StudyDB");
    const createStudySessionCollection = db.collection("create-study-session");
    const materialCollection = db.collection("material");
    const userCollection = db.collection("users");
    const noteCollection = db.collection("notes");
    const bookedSessionCollection = db.collection("booking");
    const reviewCollection = db.collection("reviews");
    const userReviewCollection = db.collection("userReviews");

    // Generate JWT
    app.post("/jwt", (req, res) => {
      const email = req.body.email;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const token = jwt.sign({ email }, process.env.TOKEN_SECRET_KEY, {
        expiresIn: "365d",
      }); // Set token expiry
      res.send({ token });
    });

    // verifyToken
    const verifyToken = (req, res, next) => {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      jwt.verify(token, process.env.TOKEN_SECRET_KEY, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        req.user = decoded;
        next();
      });
    };

    //verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ message: "Unauthorized access" });
      }

      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Forbidden:Only Admin Can access" });
      }

      next();
    };

    //verifyAdmin
    const verifyTutor = async (req, res, next) => {
      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ message: "Unauthorized access" });
      }

      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "tutor") {
        return res
          .status(403)
          .json({ message: "Forbidden:Only Tutor Can access" });
      }

      next();
    };

    //save create study in db
    app.post("/create-study", verifyToken, verifyTutor, async (req, res) => {
      const createData = req.body;
      const result = await createStudySessionCollection.insertOne(createData);
      res.send(result);
    });

    //get all create data by specific user
    app.get(
      "/create-all-study/:email",
      verifyToken,
      verifyTutor,
      async (req, res) => {
        const email = req.params.email;
        const query = { "tutor.email": email };
        const result = await createStudySessionCollection.find(query).toArray();
        res.send(result);
      }
    );

    //get all study session
    app.get(
      "/all-study-session",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await createStudySessionCollection.find().toArray();
        res.send(result);
      }
    );

    //get all approved study session
    app.get("/all-approved-study-session", async (req, res) => {
      const query = { status: "Approved" };

      const studySessions = await createStudySessionCollection
        .find(query)

        .toArray();

      res.send(studySessions);
    });

    //save material in db
    app.post("/upload-material", verifyToken, verifyTutor, async (req, res) => {
      const materialData = req.body;
      const result = await materialCollection.insertOne(materialData);
      res.send(result);
    });

    //get all material data for specific user
    app.get(
      "/all-materials/:email",
      verifyToken,
      verifyTutor,
      async (req, res) => {
        const email = req.params.email;
        const query = {
          tutorEmail: email,
        };
        const result = await materialCollection.find(query).toArray();
        res.send(result);
      }
    );

    //delete tutor material
    app.delete(
      "/delete-material/:id",
      verifyToken,
      verifyTutor,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await materialCollection.deleteOne(query);
        res.send(result);
      }
    );

    //delete admin material // admin verify
    app.delete(
      "/delete-admin-material/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await materialCollection.deleteOne(query);
        res.send(result);
      }
    );

    //save user in db
    app.post("/users", async (req, res) => {
      const user = req.body;
      //insert email if user dose not exist

      // you can do this many way (1. email unique, 2. upsert, 3. simple checking)

      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({
          message: "user already exist in database",
          insertedId: null,
        });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //get all users ///admin verify
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const search = req.query.search || "";
      const page = parseInt(req.query.page) || 1;
      const limit = 10;

      const query = { email: { $regex: search, $options: "i" } };

      const totalUsers = await userCollection.countDocuments(query);
      const users = await userCollection
        .find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      res.send({
        users,
        totalUsers,
      });
    });

    //user role management
    app.get("/user/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send({ role: result?.role });
    });

    //update user role // admin verify
    app.patch(
      "/user/role/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const { role } = req.body;
        const filter = { email };
        const updatedDoc = {
          $set: {
            role: role,
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    //change status  //and verify admin
    app.patch(
      "/change-status/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { status, reason, feedback } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: status,
            reason: reason,
            feedback: feedback,
          },
        };
        const result = await createStudySessionCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    );

    // send request admin // verify by tutor
    app.patch(
      "/change-study-status/tutor/:id",
      verifyToken,
      verifyTutor,
      async (req, res) => {
        const id = req.params.id;
        const { status } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: status,
          },
        };
        const result = await createStudySessionCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    );

    //delete approved session by admin
    app.delete(
      "/delete/admin/session/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await createStudySessionCollection.deleteOne(query);
        res.send(result);
      }
    );

    //add session fee
    app.patch(
      "/approve-session/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { amount, status } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            registrationFee: amount,
            status: status,
          },
        };
        const result = await createStudySessionCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    );

    //get all material data for admin
    app.get("/all-materials", verifyToken, verifyAdmin, async (req, res) => {
      const result = await materialCollection.find().toArray();
      res.send(result);
    });

    //get single data for a session
    app.get("/session-details/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await createStudySessionCollection
        .aggregate([
          {
            $match: { _id: new ObjectId(id) },
          },
          {
            $lookup: {
              from: "reviews",
              let: { sessionId: { $toString: "$_id" } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$sessionId", "$$sessionId"],
                    },
                  },
                },
              ],
              as: "reviews",
            },
          },
        ])
        .next();

      res.send(result);
    });

    //create note and save in to db
    app.post("/crete-note", verifyToken, async (req, res) => {
      const note = req.body;
      const result = await noteCollection.insertOne(note);
      res.send(result);
    });
    //create note and save in to db
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await userReviewCollection.insertOne(review);
      res.send(result);
    });

    //get specific student note who created
    app.get("/student/note/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const query = { studentEmail: email };
      const result = await noteCollection.find(query).toArray();
      res.send(result);
    });

    //delete note
    app.delete("/note/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await noteCollection.deleteOne(query);
      res.send(result);
    });

    //update note
    app.patch("/update/note/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { title, description } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          title: title,
          description: description,
        },
      };
      const result = await noteCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //booked student session data save in db
    app.post("/book-session", verifyToken, async (req, res) => {
      const bookedData = req.body;
      const result = await bookedSessionCollection.insertOne(bookedData);
      res.send(result);
    });

    //get specific student booked session data
    app.get("/book-session/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { studentEmail: email };
      const result = await bookedSessionCollection.find(query).toArray();
      res.send(result);
    });

    //get specific booked details data in db
    app.get("/booked-details/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookedSessionCollection.findOne(query);
      res.send(result);
    });

    //get session material that student booked
    app.get("/session-materials/:email", verifyToken, async (req, res) => {
      try {
        const studentEmail = req.params.email;

        if (!studentEmail) {
          return res.status(400).json({ error: "Student email is required" });
        }

        const materials = await db
          .collection("booking")
          .aggregate([
            { $match: { studentEmail } },

            {
              $lookup: {
                from: "material",
                localField: "sessionId",
                foreignField: "materialId",
                as: "materials",
              },
            },

            { $unwind: "$materials" },

            {
              $project: {
                _id: 0,
                bookingImage: "$image",
                sessionTitle: "$materials.sessionTitle",
                materialId: "$materials.materialId",
                materialImage: "$materials.image",
                driveLink: "$materials.driveLink",
                tutorEmail: "$materials.tutorEmail",
              },
            },
          ])
          .toArray();

        if (!materials.length) {
          return res
            .status(404)
            .json({ message: "No materials found for the booked sessions." });
        }

        res.status(200).json(materials);
      } catch (error) {
        console.error("Error fetching materials:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    //save review in db
    app.post("/reviews", verifyToken, async (req, res) => {
      const reviewData = req.body;
      const result = await reviewCollection.insertOne(reviewData);
      res.send(result);
    });

    //stripe payment
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //all tutor
    app.get("/tutors", async (req, res) => {
      const query = { role: "tutor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    //update material
    app.put(
      "/update-material/:id",
      verifyToken,
      verifyTutor,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateMaterialData = req.body;
        const updatedDoc = {
          $set: updateMaterialData,
        };
        const result = await materialCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    //update material by admin
    app.put(
      "/update-material/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateMaterialData = req.body;
        const updatedDoc = {
          $set: updateMaterialData,
        };
        const result = await materialCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Collaborative Study Platform..");
});

app.listen(port, () => {
  console.log(`Collaborative Study Platform is running on port ${port}`);
});
