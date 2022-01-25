import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { client } from "./index.js";

async function genPassword(password) {
  const rounds = 10;
  const salt = await bcrypt.genSalt(rounds);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

async function getUser(userData) {
  return await client.db("primestar").collection("userlist").findOne(userData);
}

async function createUser(
  fname,
  lname,
  username,
  email,
  hashedPassword,
  passwordConfirmation
) {
  return await client.db("primestar").collection("userlist").insertOne({
    fname,
    lname,
    username,
    email,
    password: hashedPassword,
    passwordConfirmation,
    Status: "InActive",
    token: "",
  });
}

async function getUserByEmail(email) {
  return await client.db("primestar").collection("userlist").findOne({ email });
}

async function updateUser(email, token) {
  return await client
    .db("primestar")
    .collection("userlist")
    .updateOne({ email }, { $set: { token: token } });
}

async function getUserById(id) {
  return await client.db("primestar").collection("userlist").findOne({ token: id });
}

function Mail(email, res, message) {
  const mail = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.email,
      pass: process.env.password,
    },
  });

  const mailOptions = {
    from: process.env.email,
    to: email,
    subject: "Mail From URL Shortener",
    html: message,
  };

  mail.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.log("Mail", err);
      res.status(404).send("error");
    } else {
      console.log("Mailstatus :", info.response);
      res.send("Mail Sent For verification");
    }
  });
}

export {
  genPassword,
  Mail,
  getUser,
  createUser,
  getUserByEmail,
  updateUser,
  getUserById,
};
