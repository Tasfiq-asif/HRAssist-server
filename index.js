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

    //colection

    const db = client.db('HRAssist');
    usersCollection = db.collection('users');
    const workEntriesCollection = db.collection("workEntries");
    const paymentsCollection = db.collection('payments');
    const messagesCollection = db.collection('messages');

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

    app.post('/contact', async (req, res) => {
  const { email, message } = req.body;

  if (!email || !message) {
    return res.status(400).json({ error: 'Email and message are required' });
  }

  try {
    await messagesCollection.insertOne({ email, message, createdAt: new Date() });
    res.status(200).json({ message: 'Message saved successfully' });
  } catch (error) {
    console.error('Failed to save message:', error);
    res.status(500).json({ error: 'Failed to save message' });
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
app.get('/worksheet/:employeeemail',async (req, res) => {
  try {
    const employeeEmail = req.params.employeeemail
    const workEntries = await workEntriesCollection.find({employeeEmail}).sort({date:-1}).toArray();
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

app.get("/payment-history",verifytoken, async (req, res) => {
  const { userId } = req.user; // Assuming user is logged in and userId is available in req.user

  try {
    // Connect to the MongoDB client
    await client.connect();

   

    // Fetch all payment data for the logged-in employee, sorted by year and month
    const payments = await paymentsCollection
      .find({ employeeId: userId }) // Filter by employeeId
      .sort({ year: -1, month: -1 }) // Sort by year (descending) and month (descending)
      .toArray(); // Convert the cursor to an array

    res.json({
      payments,
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({ message: "Error fetching payment history" });
  } finally {
    // Ensure we close the database connection
    await client.close();
  }
});

// ***************** HR related APIS ****************

app.get('/employees', async (req, res) => {
  try {
    const employees = await usersCollection.find({}).toArray();
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/employees/:email/verify', async (req, res) => {
  const { email } = req.params;

  try {
    // Find the employee by email
    const employee = await usersCollection.findOne({ email });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if isVerified field exists, if not, add it with a default value of false
    const updatedEmployee = await usersCollection.updateOne(
      { email },  // Use email for the query
      {
        $set: {
          isVerified: employee.isVerified !== undefined ? !employee.isVerified : true
        }
      }
    );
    res.json({
      success: true,
      isVerified: employee.isVerified !== undefined ? !employee.isVerified : true
    });
  } catch (error) {
    console.error('Error toggling verified status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/work-entries', async (req, res) => {
  const { employeeEmail, month } = req.query;

  try {
    const query = {};

    if (employeeEmail) query.employeeEmail = employeeEmail;

    if (month) {
      const [year, monthIndex] = month.split('-'); // "2024-11" -> year: 2024, monthIndex: 11
      const startOfMonth = new Date(year, monthIndex - 1, 1);
      const endOfMonth = new Date(year, monthIndex, 0);
      query.date = { $gte: startOfMonth.toISOString(), $lte: endOfMonth.toISOString() };
    }

    const results = await workEntriesCollection.find(query).toArray();
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching work entries.');
  }
});



app.get("/employees/:slug", async (req, res) => {
  const { slug } = req.params; // slug could be email or another unique identifier

  try {
    // Fetch employee details from `employeesCollection`
    const employee = await paymentsCollection.findOne({ employeeEmail: slug });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Fetch salary history from `paymentsCollection`
    const salaryHistory = await paymentsCollection
      .find({ employeeEmail: slug })
      .sort({ year: 1, month: 1 }) // Sort by year and month for chart plotting
      .toArray();

    res.json({ employee, salaryHistory });
  } catch (error) {
    console.error("Error fetching employee details:", error);
    res.status(500).json({ message: "Server error" });
  }
});



// Pay employee
app.post('/employees/:email/pay', async (req, res) => {
  const { email } = req.params;
  const { month, year } = req.body;

  try {
    const employee = await usersCollection.findOne({ email });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (!employee.isVerified) {
      return res.status(400).json({ message: 'Cannot pay unverified employee' });
    }

    // Save payment details (this is just a log, modify as needed)
    const paymentEntry = {
      employeeEmail: email,
      amount: employee.salary,
      month,
      year,
      paidAt: new Date(),
    };
    await paymentsCollection.insertOne(paymentEntry);

    res.json({ message: `Paid ${employee.salary} to ${employee.name} for ${month}/${year}` });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// *****************Admin routes****************
  app.get('/verified-employees', async (req, res) => {
  try {
    const employees = await usersCollection.find({
  isVerified: true,
  isFired: { $exists: false }
}).toArray();

    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/employees/:email/fire', async (req, res) => {
  const { email } = req.params;

  try {
    const updatedEmployee = await usersCollection.updateOne(
      { email },
      { $set: { isFired: true } }
    );

    if (updatedEmployee.modifiedCount === 0) {
      return res.status(404).json({ message: 'Employee not found or already fired' });
    }

    res.json({ success: true, message: 'Employee fired' });
  } catch (error) {
    console.error('Error firing employee:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/employees/:email/make-hr', async (req, res) => {
  const { email } = req.params;

  try {
    const updatedEmployee = await usersCollection.updateOne(
      { email },
      { $set: { role: 'HR' } }
    );

    if (updatedEmployee.modifiedCount === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ success: true, message: 'Employee promoted to HR' });
  } catch (error) {
    console.error('Error promoting employee to HR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/employees/:email/salary', async (req, res) => {
  const { email } = req.params;
  const { salary } = req.body;  // Assuming salary is passed in the request body.

  try {
    const updatedEmployee = await usersCollection.updateOne(
      { email },
      { $set: { salary } }
    );

    if (updatedEmployee.modifiedCount === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ success: true, message: 'Salary updated' });
  } catch (error) {
    console.error('Error updating salary:', error);
    res.status(500).json({ error: 'Server error' });
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