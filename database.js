const mongoose = require('mongoose')

const connectDB = async ()=>{
    try{
await mongoose.connect(
  "mongodb+srv://prakasherg_db_user:9976023829@ac-lrpycxt.76vcgcl.mongodb.net/ecommerce?retryWrites=true&w=majority",
  {
    serverSelectionTimeoutMS: 5000,
  }
);
    console.log("MongoDb Connected!!!")
}   catch(e){
    console.log(e)
}
}

module.exports = connectDB