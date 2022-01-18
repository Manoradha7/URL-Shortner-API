import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

async function genPassword(password) {
  const rounds = 10;
  const salt = await bcrypt.genSalt(rounds);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
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

export { genPassword, Mail };
