import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config()

const signupauth=(request,response,next)=>{
    try{
        const token =request.header('x-auth-token')
        const verify=jwt.verify("Token Verification",verify);
        next()
    }catch(err){
        response.send({Message:err.Message})
    }
}

export {signupauth}