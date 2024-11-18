const express = require('express')
const app = express()
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 8000 ;
const cookieParser = require('cookie-parser'); 
require('dotenv').config();


const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionsSuccessStatus: 200,
};

// ********************************Middlewares ********************************
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const verifytoken = (req, res, next) => {
  const token = req?.cookies?.token
  if(!token){
    return res.status(401).send({message: 'unAuthorize Access'})
  }
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err,decoded)=>{
   if(err){
    return res.status(401).send({message:'unauthorized'})
   }
    req.user=decoded
    next()
  })
}

 const verifyAdmin = async (req, res,next) => {
      const user = req.user
      const query = {email:user?.email}
      const result = await usersCollection.findOne(query)
      if (!result || result?.role !== 'admin')
        return res.status(401).send({ message: 'unauthorized access!!' })

      next()

    }


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.onhj8vc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// Global variable for the collection
let usersCollection;


async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    const db = client.db('HRAssist');
    usersCollection = db.collection('users');
    const workEntriesCollection = db.collection("workEntries");

  // *****************JWT****************

     app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', //Return true/false
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    // Google Sign In
    app.post('/google-sign-in', async (req, res) => {
      try {
        const { email, name, photo } = req.body;

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          // User exists, just return success
          return res.status(200).json({ message: 'User already exists', user: existingUser });
        }

        // User doesn't exist, create new user
        const newUser = {
          email,
          name,
          photo,
          role: 'user', // Default role
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);

        res.status(201).json({ message: 'User registered successfully', userId: result.insertedId });
      } catch (error) {
        console.error('Error in Google sign-in:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // *******************************User related API*******************************
    // *****************save user****************
   // Save user (for non-Google sign-ups)
    app.post('/user', async (req, res) => {
      try {
        const { email, name, phone, role, bank_account_no, designation, photo } = req.body;

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          // User already exists, return an appropriate response
          return res.status(200).json({ message: 'User already exists', user: existingUser });
        }

        // User doesn't exist, create new user
        const newUser = {
          email,
          name,
          phone,
          role,
          bank_account_no,
          designation,
          photo,
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);

        res.status(201).json({ message: 'User registered successfully', userId: result.insertedId });
      } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

       app.get('/users',async (req, res) => {
      const users = await usersCollection.find().toArray()
      res.send(users)
    })

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({email})
      res.send(result)
    })
// *****************User Dashboard Related Api****************
app.get('worksheet/:employeeemail',async (req, res) => {
  try {
    const employeeEmail = req.params.employeeemail
    const workEntries = await workEntriesCollection.find({employeeId}).sort({date:-1}).toArray();
    res.send(workEntries);
  } catch (error) {
    console.error("Error fetching work entries:", error);
    res.status(500).json({ error: "Server error" });
  }
})

app.post('/work-entries', verifytoken, async (req, res) => {
  try {
    const { task, hours, date, employeeEmail } = req.body;
    const newEntry = {
      task,
      hours,
      date,
      employeeEmail,
      createdAt: new Date(),
    };

    const result = await workEntriesCollection.insertOne(newEntry);

    res.status(201).json(newEntry);
  } catch (error) {
    console.error('Error saving work entry:', error);
    res.status(500).json({ error: 'Failed to save work entry' });
  }
});



    // *****************logOUT****************

    app.get('/logout', (req, res) => {
  try {
    res
      .clearCookie('token', {
        httpOnly: true, // To match how the cookie was set initially
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      })
      .send({ success: true });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});



    

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Do not close the client to keep the connection open for further requests
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})