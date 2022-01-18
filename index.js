import express from "express";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import bodyParser from "body-parser";
import cors from "cors";
// import { signupauth } from "./auth.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { genPassword, Mail } from "./helper.js";

const app = express();

dotenv.config();
app.use(express.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT;

// const MONGO_URL = "mongodb://localhost";
const MONGO_URL = process.env.MONGO_URL;

async function createConnection() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  console.log("Mongodb has started");
  return client;
}

export const client = await createConnection();

app.listen(PORT, console.log("App is running in port", PORT));

app.get("/", (req, res) => {
  res.send("Welcome to URL SHORTNER");
});

app.post("/users/signup", async (req, res) => {
  const { fname, lname, username, email, password, passwordConfirmation } =
    req.body;

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
  if (password.length < 8) {
    return req
      .status(400)
      .send({ Message: "Password length should have 8 characters" });
  }

  const userData = {
    $or: [{ username: { $eq: username } }, { email: { $eq: email } }],
  };

  const data = await client
    .db("primestar")
    .collection("userlist")
    .findOne(userData);
  console.log(data);

  if (data) {
    return res
      .status(400)
      .send({ Message: "UserName or Email Already exists" });
  }

  const hashedPassword = await genPassword(password);
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
  console.log("createUser :", createUser);

  const getData = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ email });
  console.log(getData);
  const token = jwt.sign({ id: getData._id }, process.env.SECRET_KEY);
  console.log("token :", token);

  const storeToken = await client
    .db("primestar")
    .collection("userlist")
    .updateOne({ email }, { $set: { token: token } });

  const link = `http://localhost:8000/users/twostepverification/${token}`;

  const message = `<h3>Greetings ${fname} !!!</h3>
  <p>Welcome to the world of URL SHORTNER</p>
  <p>Using our services you can Simplify your links, customize &amp; manage them at free of cost</p>
  <a href=${link}>Click the link to complete two step verification</a>
  <p>Two step verification is mandatory to sIGNin</p>
  <p>Regards,</p>
  <p>URL SHORTNER Team</p>`;

  const mail = Mail(email, res, message);
});

app.get("/users/twostepverification/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = jwt.verify(id, process.env.SECRET_KEY);
    if (result) {
      const getData = await client
        .db("primestar")
        .collection("userlist")
        .findOne({ token: id });
      const { _id, Status, token } = await getData;
      const statusChange = await client
        .db("primestar")
        .collection("userlist")
        .updateOne(
          { _id: _id },
          { $set: { Status: "Active" } },
          { $unset: { token } }
        );
      res.redirect(`http://localhost:3000/activationmessage`);
    }
  } catch (err) {
    return res.status(400).send({ Message: "Link Expired" });
  }
});

app.post("/users/signin", async (req, res) => {
  const { email, password } = req.body;

  const data = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ email });
  console.log(data);

  if (!data) {
    return res.status(400).send({ Message: "Invalid Credential - Email" });
  }

  const { _id, password: hashedPassword, Status } = await data;

  if (Status === "InActive") {
    return res.status(400).send({ Message: "Need to Activate Your Account" });
  }

  const passwordCheck = await bcrypt.compare(password, hashedPassword);

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

app.post("/users/forgotpassword", async (req, res) => {
  const { email } = req.body;

  const data = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ email });

  if (!data) {
    return res.status(400).send({ Message: "Invalid Credentials" });
  }

  const { _id, Status, password, fname } = await data;
  if (!Status) {
    return res.status(400).send({ Message: "Your Account is InActive" });
  }
  const token = jwt.sign({ id: _id }, process.env.SECRET_KEY);
  const tokenchange = await client
    .db("primestar")
    .collection("userlist")
    .updateOne({ _id: _id }, { $set: { password: token } });
  console.log(tokenchange);
  const link = `http://localhost:8000/users/forgotpassword/verify/${token}`;

  const message = `<h3>Greetings ${fname} !!!</h3>
  <p>Use the Below link to reset your password.  </p>
  <a href=${link}>Click the link to reset your password.</a>
  <p>Regards,</p>
  <p>URL SHORTNER Team</p>`;

  Mail(email, res, message);
});

app.get("/users/forgotpassword/verify/:id", async (req, res) => {
  const { id } = req.params;
  console.log(id);
  const datacheck = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ password: id });
  console.log(datacheck);
  if (!datacheck) {
    return res.status(400).send({ Message: "Link Expired" });
  }
  return res.redirect(`http://localhost:3000/resetpassword/${id}`);
});

app.post("/users/resetpassword", async (req, res) => {
  const { password ,passwordConfirmation,token} = req.body;
  
  // console.log("password :", password);
  // console.log("token :", token);
  // console.log("passwordconfirmation",passwordConfirmation)

  if (password.length < 8) {
    return res.status(400).send({ Message: "Password must be longer" });
  }

  const check = await client
    .db("primestar")
    .collection("userlist")
    .findOne({ password: token });
    console.log(check)
  if (!check) {
    return res.status(400).send({ Message: "Link expired" });
  }

  const { email } = await check;
  // console.log("email",email)
  const hashedPassword = await genPassword(password);
  const updatepassword = await client.db("primestar").collection("userlist").updateOne({email},{$set:{password:hashedPassword,passwordConfirmation:passwordConfirmation}});
  const checkdata = await client
    .db("primestar")
    .collection("userlist")
    .findOne({email});
    console.log(checkdata)
  if(updatepassword){
    return res.status(200).send({Message:"Password Successfully Changed"})
  }else{
    return res.status(400).send({Message:"Something Went Wrong"})
  }
});


app.get('/users/getdata',async(req,res)=>{
  const token =req.header('x-auth-token')
  const check =await client.db('primestar').collection('userlist').findOne({token:token})
 if(!check){
   return res.status(404).send('Not found')
 }
 return res.send(check)
})

app.get('/users/userdata',async(req,res)=>{
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


