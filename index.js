//import required packages
import express from "express";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import bodyParser from "body-parser";
import cors from "cors";
// import { signupauth } from "./auth.js";
import { UserRouter } from "./routes/user.js";

const Base_Url = `https://url--shortner--app.herokuapp.com/`

//create express app named it as app
const app = express();

//Middleware
dotenv.config();
app.use(express.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(cors());
app.use(bodyParser.json());

//route
app.use("/users",UserRouter);

//Server configration 
const PORT = process.env.PORT;

// const MONGO_URL = "mongodb://localhost";
const MONGO_URL = process.env.MONGO_URL;

//create connection to mongodb
async function createConnection() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  console.log("Mongodb has started");
  return client;
}

//make client as globally available to connect db
export const client = await createConnection();

//make app to listen the port
app.listen(PORT, console.log("App is running in port", PORT));

//create a home route path 
app.get("/", (req, res) => {
  res.send("Welcome to URL SHORTNER");
});

function generateUrl(){
  let randomResult = '';
 let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
 let charactersLength = characters.length;

 for(let i=0;i<5;i++){
   randomResult += characters.charAt(Math.floor(Math.random()*charactersLength));
 }
 return randomResult;
}

app.post('/url/createUrl',async(req,res)=>{
  const {longUrl,customUrl,shortUrl,count} = req.body;
  
  //store the data into database
  const createurl = await client.db('primestar').collection("urllist").insertOne({longUrl,customUrl,shortUrl,count})

  const getdata = await client.db('primestar').collection("urllist").findOne({longUrl})
   console.log(getdata)
  const shorturl = Base_Url+generateUrl();
  console.log("su",shorturl)
  const updateShorturl = await client.db('primestar').collection("urllist").updateOne({longUrl},{$set:{shortUrl:shorturl}}) 

  const getdata2 = await client.db('primestar').collection("urllist").findOne({longUrl})
  console.log(getdata2)
})

app.get('/url/urldata',async(req,res)=>{
  const geturl = await client.db('primestar').collection("urllist").findOne()
  res.send(geturl);
})
