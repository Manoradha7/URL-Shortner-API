//import required packages
import express from "express";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import bodyParser from "body-parser";
import cors from "cors";
// import { signupauth } from "./auth.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { genPassword, Mail } from "./helper.js";

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

//signup
app.post("/users/signup", async (req, res) => {
  //get values from the body
  const { fname, lname, username, email, password, passwordConfirmation } =
    req.body;
  //check the input as empty or not
  if (
    fname === null ||
    lname === null ||
    username === null ||
    email === null ||
    password === null ||
    passwordConfirmation === null
  ) {
    return res.status(400).send({ Message: "This feild must be required" });
  }
  //check the password length
  if (password.length < 8) {
    return req
      .status(400)
      .send({ Message: "Password length should have 8 characters" });
  }
 
  const userData = {
    $or: [{ username: { $eq: username } }, { email: { $eq: email } }],
  };
  //check the userdata is there or not
  const data = await client
    .db("primestar")
    .collection("userlist")
    .findOne(userData);
  console.log(data);
//if there is data return an data exists message
  if (data) {
    return res
      .status(400)
      .send({ Message: "UserName or Email Already exists" });
  }
//if there is no data change the password to hashedpassword
  const hashedPassword = await genPassword(password);
  //store the userdata into the database
  const createUser = await client
    .db("primestar")
    .collection("userlist")
    .insertOne({
      fname,
      lname,
      username,
      email,
      password: hashedPassword,
      passwordConfirmation,
      Status: "InActive",
      token: "",
    });
  // console.log("createUser :", createUser);

//get the stored data 
  const getData = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ email });
  // console.log(getData);

  //create token
  const token = jwt.sign({ id: getData._id }, process.env.SECRET_KEY);
  // console.log("token :", token);

  //update the data
  const storeToken = await client
    .db("primestar")
    .collection("userlist")
    .updateOne({ email }, { $set: { token: token } });

  const link = `https://url--shortner--app.herokuapp.com/users/twostepverification/${token}`;

  const message = `<h3>Greetings ${fname} !!!</h3>
  <p>Welcome to the world of URL SHORTNER</p>
  <p>Using our services you can Simplify your links, customize &amp; manage them at free of cost</p>
  <a href=${link}>Click the link to complete two step verification</a>
  <p>Two step verification is mandatory to Signin</p>
  <p>Regards,</p>
  <p>URL SHORTNER Team</p>`;
//sent mail for activate the account
  const mail = Mail(email, res, message);
});

//twostepverification
app.get("/users/twostepverification/:id", async (req, res) => {
  //get id from url
  const { id } = req.params;
  try {

    //verify the token
    const result = jwt.verify(id, process.env.SECRET_KEY);

    //if token matched
    if (result) {
      //get data
      const getData = await client
        .db("primestar")
        .collection("userlist")
        .findOne({ token: id });
      const { _id, Status, token } = await getData;

      //update status as active
      const statusChange = await client
        .db("primestar")
        .collection("userlist")
        .updateOne(
          { _id: _id },
          { $set: { Status: "Active" } },
          { $unset: { token } }
        );
      res.redirect(`https://relaxed-fermat-816b32.netlify.app/activationmessage`);
    }
  } catch (err) {
    return res.status(400).send({ Message: "Link Expired" });
  }
});

//signin
app.post("/users/signin", async (req, res) => {
  //get email and password from body
  const { email, password } = req.body;
//get the data from DB for verification
  const data = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ email });
  // console.log(data);

  //if there is no data return error message
  if (!data) {
    return res.status(400).send({ Message: "Invalid Credential - Email" });
  }

  const { _id, password: hashedPassword, Status } = await data;

  //if there is data check status as active or not
  if (Status === "InActive") {
    return res.status(400).send({ Message: "Need to Activate Your Account" });
  }

  // compare the password
  const passwordCheck = await bcrypt.compare(password, hashedPassword);

  //if password matched 
  if (passwordCheck) {
    const token = jwt.sign({ id: data._id }, process.env.SECRET_KEY);
    const tokenupdate = await client
      .db("primestar")
      .collection("userlist")
      .updateOne({ email }, { $set: { token: token } });
    return res.status(200).send({ Message: "Signin Succesfully" });
  } else {
    return res.status(400).send({ Message: "Invalid credentials - password" });
  }
});

//forgotpassword
app.post("/users/forgotpassword", async (req, res) => {
  //get the email from body
  const { email } = req.body;

  //check the data present are not
  const data = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ email });

  //if the there is no data return an error message
  if (!data) {
    return res.status(400).send({ Message: "Invalid Credentials" });
  }

  const { _id, Status, password, fname } = await data;
  //check the data if stautus is active or not
  if (!Status) {
    return res.status(400).send({ Message: "Your Account is InActive" });
  }
  //create the token
  const token = jwt.sign({ id: _id }, process.env.SECRET_KEY);
  //change the password to token
  const tokenchange = await client
    .db("primestar")
    .collection("userlist")
    .updateOne({ _id: _id }, { $set: { password: token } });
  // console.log(tokenchange);
  const link = `https://url--shortner--app.herokuapp.com/users/forgotpassword/verify/${token}`;

  const message = `<h3>Greetings ${fname} !!!</h3>
  <p>Use the Below link to reset your password.  </p>
  <a href=${link}>Click the link to reset your password.</a>
  <p>Regards,</p>
  <p>URL SHORTNER Team</p>`;
//sent the mail for verification 
  Mail(email, res, message);
});

//verification 
app.get("/users/forgotpassword/verify/:id", async (req, res) => {
  // get the id
  const { id } = req.params;
  // console.log(id);

  //check the data
  const datacheck = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ password: id });
  // console.log(datacheck);

  //if there no data return an error message
  if (!datacheck) {
    return res.status(400).send({ Message: "Link Expired" });
  }
  return res.redirect(`https://relaxed-fermat-816b32.netlify.app/resetpassword/${id}`);
});

//Resetpassword
app.post("/users/resetpassword", async (req, res) => {
  //get require data from the body
  const { password ,passwordConfirmation,token} = req.body;

  //check the password length
  if (password.length < 8) {
    return res.status(400).send({ Message: "Password must be longer" });
  }

  //check the data
  const check = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ password: token });
    // console.log(check)
//the data is not there return an error
  if (!check) {
    return res.status(400).send({ Message: "Link expired" });
  }
//get the email from the data
  const { email } = await check;
  // console.log("email",email)

  //change the password into hashed password
  const hashedPassword = await genPassword(password);

  // update the password into db
  const updatepassword = await client.db("primestar").collection("userlist").updateOne({email},{$set:{password:hashedPassword,passwordConfirmation:passwordConfirmation}});
 
  //check the data
  const checkdata = await client
    .db("primestar")
    .collection("userlist")
    .findOne({email});
    // console.log(checkdata)
  
  //if password updated then return success message
  if(updatepassword){
    return res.status(200).send({Message:"Password Successfully Changed"})
  }else{
    return res.status(400).send({Message:"Something Went Wrong"})
  }
});

//gettingg the data
app.get('/users/getdata',async(req,res)=>{
  //get the token from header
  const token =req.header('x-auth-token')
  //check the data
  const check =await client.db('primestar').collection('userlist').findOne({token:token})
//there is no data return an error
 if(!check){
   return res.status(404).send('Not found')
 }
 return res.send(check)
})

//userdata
app.get('/users/userdata',async(req,res)=>{
  //get the token from the header
  const token = req.header('x-auth-token')
  const getData = await client.db("primestar").collection("userlist").findOne({token:token});
  const {email}= await getData;
  const getdata = await client.db("primestar").collection('userlist').aggregate([{$lookup:{from:"URL_SHORTNER",localField:"email",foreignField:"email",as:"urls",},},{$match:{"email":email}},]).toArray();
  const result = await get[0].urls
  if(!result){
    return res.status(404).send('Not Found')
  }
  return res.send(result)
})


