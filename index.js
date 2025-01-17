require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
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
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("StudyDB");
    const createStudySessionCollection = db.collection("create-study-session");
    const materialCollection = db.collection("material");
    const userCollection = db.collection("users");
    const noteCollection = db.collection("notes");
    const bookedSessionCollection = db.collection("booking");
    const reviewCollection = db.collection("reviews");

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

    //save create study in db
    app.post("/create-study", verifyToken, async (req, res) => {
      const createData = req.body;
      const result = await createStudySessionCollection.insertOne(createData);
      res.send(result);
    });

    //get all create data by specific user
    app.get("/create-all-study/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "tutor.email": email };
      const result = await createStudySessionCollection.find(query).toArray();
      res.send(result);
    });

    //get all study session
    app.get("/all-study-session", verifyToken, async (req, res) => {
      const result = await createStudySessionCollection.find().toArray();
      res.send(result);
    });

    //get all approved study session
    app.get("/all-approved-study-session", async (req, res) => {
      const query = { status: "Approved" };
      const result = await createStudySessionCollection.find(query).toArray();
      res.send(result);
    });

    //save material in db
    app.post("/upload-material", verifyToken, async (req, res) => {
      const materialData = req.body;
      const result = await materialCollection.insertOne(materialData);
      res.send(result);
    });

    //get all material data for specific user
    app.get("/all-materials/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        tutorEmail: email,
      };
      const result = await materialCollection.find(query).toArray();
      res.send(result);
    });

    //delete tutor material
    app.delete("/delete-material/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await materialCollection.deleteOne(query);
      res.send(result);
    });

    //delete admin material
    app.delete("/delete-admin-material/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await materialCollection.deleteOne(query);
      res.send(result);
    });

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

    //get all users
    app.get("/users", verifyToken, async (req, res) => {
      const search = req.query.search;

      //search by email in inputField
      let query = { email: { $regex: search, $options: "i" } };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    //user role management
    app.get("/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send({ role: result?.role });
    });

    //update user role
    app.patch("/user/role/:email", verifyToken, async (req, res) => {
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
    });

    //change status
    app.patch("/change-status/:id", verifyToken, async (req, res) => {
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
    });

    //add session fee
    app.patch("/approve-session/:id", verifyToken, async (req, res) => {
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
    });

    //get all material data for admin
    app.get("/all-materials", verifyToken, async (req, res) => {
      const result = await materialCollection.find().toArray();
      res.send(result);
    });

    //get single data for a session
    app.get("/session-details/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await createStudySessionCollection.findOne(query);

      res.send(result);
    });

    //create note and save in to db
    app.post("/crete-note", verifyToken, async (req, res) => {
      const note = req.body;
      const result = await noteCollection.insertOne(note);
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

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
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
