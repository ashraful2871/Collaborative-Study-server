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

    // Generate JWT
    app.post("/jwt", (req, res) => {
      const email = req.body.email;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const token = jwt.sign({ email }, process.env.TOKEN_SECRET_KEY, {
        expiresIn: "1h",
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

    //get all create data
    app.get("/create-all-study/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "tutor.email": email };
      const result = await createStudySessionCollection.find(query).toArray();
      res.send(result);
    });

    //save material in db
    app.post("/upload-material", verifyToken, async (req, res) => {
      const materialData = req.body;
      const result = await materialCollection.insertOne(materialData);
      res.send(result);
    });

    //get all material data
    app.get("/all-materials/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        tutorEmail: email,
      };
      const result = await materialCollection.find(query).toArray();
      res.send(result);
    });

    //delete material
    app.delete("/delete-material/:id", verifyToken, async (req, res) => {
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
      const result = await userCollection.find().toArray();
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
