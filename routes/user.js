import express from "express";
import {genPassword, Mail, getUser, createUser, getUserByEmail,updateUser ,getUserById} from "../helper.js";
import jwt from "jsonwebtoken";
import bcrypt from 'bcrypt';
import { client } from "../index.js";


const router = express.Router();

//signup
router.route("/signup").post(async (req, res) => {
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
    return res
      .status(400)
      .send({ Message: "Password length should have 8 characters" });
  }

  const userData = {
    $or: [{ username: { $eq: username } }, { email: { $eq: email } }],
  };
  //check the userdata is there or not
  const data = await getUser(userData);
  //if there is data return an data exists message
  if (data) {
    return res
      .status(400)
      .send({ Message: "UserName or Email Already exists" });
  }
  //if there is no data change the password to hashedpassword
  const hashedPassword = await genPassword(password);
  //store the userdata into the database
  const createuser = await createUser(fname, lname, username, email, hashedPassword, passwordConfirmation);
  // console.log("createUser :", createUser);

  //get the stored data
  const getData = await getUserByEmail(email);
  // console.log(getData);

  //create token
  const token = jwt.sign({ id: getData._id }, process.env.SECRET_KEY);
  // console.log("token :", token);

  //update the data
  const storeToken = await updateUser(email, token);

  const link = `https://url--shortner--app.herokuapp.com/users/twostepverification/${token}`;

  const message = `<h3>Greetings ${fname} !!!</h3>
      <p>Welcome to the world of URL SHORTNER</p>
      <p>Using our services you can Simplify your links, customize &amp; manage them at free of cost</p>
      <a href=${link}>Click the link to complete two step verification</a>
      <p>Two step verification is mandatory to Signin</p>
      <p>Regards,</p>
      <p>URL SHORTNER Team</p>`;

  const mail = Mail(email, res, message);

  return res.status(200).json({Message:'Mail send for Verification'});
});

router.route("/twostepverification/:id").get(async(req,res)=>{
  const {id} = req.params;
  try{
      //verify token
      const tokenverify = jwt.verify(id,process.env.SECRET_KEY);

      //get the user data using token
      const getData = await client.db("primestar").collection("userlist").findOne({token:id})

      const {_id,Status,token} = await getData;
      //update the status of the user
      const statusUpdate = await client.db("primestar").collection("userlist").updateOne({_id},{$set:{Status:"Active",token:''}})
      res.redirect(`https://relaxed-fermat-816b32.netlify.app/activationmessage`)
  }catch (err){
     console.log(err)
      return res.status(400).send({Message:"Link Expired"})
  }
})

//signin
router.route('/signin').post(async (req, res) => {
  //get email and password from body
  const { email, password } = req.body;
//get the data from DB for verification
  const data = await getUserByEmail(email);
  // console.log(data);

  //if there is no data return error message
  if (!data) {
    return res.status(400).send({ Message: "Invalid Credential" });
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
    const tokenupdate = await updateUser(email, token);
    return res.status(200).send({ Message: "Signin Succesfully" });
  } else {
    return res.status(400).send({ Message: "Invalid credentials" });
  }
})

//forgotpassword
router.route('/forgotpassword').post(async (req, res) => {
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
})

router.route("/forgotpassword/verify/:id").get(async (req, res) => {
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
})
//resetpassword
router.route("/resetpassword").post(async (req, res) => {
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
})

export const UserRouter = router;



