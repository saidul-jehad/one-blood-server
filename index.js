const express = require('express')
const app = express();
const cors = require("cors")
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;


// middleWare
app.use(
    cors({
        origin: [
            "http://localhost:5173",
        ],
        credentials: true,
    })
);
app.use(express.json())

console.log(process.env.DB_PASS, process.env.DB_USER);





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ujjqksd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db("oneBloodDB").collection("users");
        const donationRequestCollection = client.db("oneBloodDB").collection("donationRequest");


        // oun middleWare
        const verifyToken = async (req, res, next) => {
            const token = req?.headers?.authorization?.split(' ')[1];

            if (!token) {
                return res.status(401).send({ message: "unauthorized access" })
            }
            // console.log(token);
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    console.log("errrrrrrrr");
                    return res
                        .status(401)
                        .send({ message: "unauthorized access" })
                }
                console.log("dec");
                req.decoded = decoded
                next()
            })
        }

        // use verify admin after verify token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            console.log(email);
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: "forbidden access" })
            }
            next()
        }


        // jwt related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token })
        })



        // user related api
        app.get('/all-users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.patch('/update-user-status/:id', async (req, res) => {
            const id = req.params.id
            const newStatus = req.body.status
            console.log(newStatus);
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: newStatus
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.patch('/update-user-role/:id', async (req, res) => {
            const id = req.params.id
            const newRole = req.body.role
            console.log(newRole);
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: newRole
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email

            if (email !== req?.decoded?.email) {
                return res
                    .status(403)
                    .send({ message: "forbidden access" })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)

            let admin = false
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })

        app.get('/users/volunteer/:email', verifyToken, async (req, res) => {
            const email = req.params.email

            if (email !== req?.decoded?.email) {
                return res
                    .status(403)
                    .send({ message: "forbidden access" })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)

            let volunteer = false
            if (user) {
                volunteer = user?.role === 'volunteer'
            }
            res.send({ volunteer })
        })


        app.post('/users', async (req, res) => {
            const userInfo = req.body
            console.log(userInfo);
            const result = await userCollection.insertOne(userInfo);
            res.send(result)
        })




        // donationRequest related api

        app.get("/recent-donation-request", async (req, res) => {
            const result = await donationRequestCollection.find().sort({ timeStamp: -1 }).toArray()
            
            res.send(result)
        })


        app.get('/all-donation-request', async (req, res) => {
            const status = req.query.status
            if (status !== "all") {
                console.log(status);
                const query = { donation_status: status }
                const result = await donationRequestCollection.find(query).toArray()
                return res.send(result)
            }

            const result = await donationRequestCollection.find().toArray()
            res.send(result)
        })

        app.get('/my-donation-request/:email', async (req, res) => {
            const email = req.params.email
            const status = req.query.status
            if (status !== "all") {
                console.log(status);
                const query = {
                    donation_status: status,
                    requester_email: email
                }
                const result = await donationRequestCollection.find(query).toArray()
                return res.send(result)
            }
            const query = { requester_email: email }
            const result = await donationRequestCollection.find(query).toArray()
            res.send(result)
        })


        app.get('/donation-request', async (req, res) => {
            const query = {
                donation_status: 'pending'
            }
            const result = await donationRequestCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/donation-request/:id', async (req, res) => {
            const id = req.params.id
            const query = {
                donation_status: 'pending',
                _id: new ObjectId(id)
            }
            const result = await donationRequestCollection.findOne(query)
            res.send(result)
        })

        app.get('/donation-request-byId/:id', async (req, res) => {
            const id = req.params.id
            const query = {
                _id: new ObjectId(id)
            }
            const result = await donationRequestCollection.findOne(query)
            res.send(result)
        })

        app.patch('/donate/:id', async (req, res) => {
            const id = req.params.id
            const donorInfo = req.body
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    donation_status: "inprogress",
                    ...donorInfo
                },
            };
            const result = await donationRequestCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.patch('/update-donation-request/:id', async (req, res) => {
            const id = req.params.id
            const newDonorInfo = req.body
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...newDonorInfo
                },
            };
            const result = await donationRequestCollection.updateOne(filter, updateDoc)
            res.send(result)
        })



        app.patch('/done-cancel/:id', async (req, res) => {
            const id = req.params.id
            const status = req.query.status
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    donation_status: status
                },
            };
            const result = await donationRequestCollection.updateOne(filter, updateDoc)
            res.send(result)

        })


        app.delete('/delete-request/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }

            const result = await donationRequestCollection.deleteOne(filter)
            res.send(result)

        })



        app.post('/donation-request', async (req, res) => {
            const requestInfo = req.body
            const result = await donationRequestCollection.insertOne(requestInfo)
            res.send(result)
        })








        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send("One Blood Server is running")
})

app.listen(port, () => {
    console.log(`One Blood Server is Running Port: ${port}`)
})